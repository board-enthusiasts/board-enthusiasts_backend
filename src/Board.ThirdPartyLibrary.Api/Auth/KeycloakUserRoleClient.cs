using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Board.ThirdPartyLibrary.Api.Auth;

/// <summary>
/// Keycloak admin client that ensures realm roles are assigned to users.
/// </summary>
internal sealed class KeycloakUserRoleClient : IKeycloakUserRoleClient
{
    private readonly HttpClient _httpClient;
    private readonly IKeycloakEndpointResolver _endpointResolver;
    private readonly KeycloakOptions _options;

    /// <summary>
    /// Initializes a new instance of the <see cref="KeycloakUserRoleClient"/> class.
    /// </summary>
    /// <param name="httpClient">Injected HTTP client.</param>
    /// <param name="endpointResolver">Resolver for Keycloak endpoint URIs.</param>
    /// <param name="options">Bound Keycloak configuration.</param>
    public KeycloakUserRoleClient(
        HttpClient httpClient,
        IKeycloakEndpointResolver endpointResolver,
        IOptions<KeycloakOptions> options)
    {
        _httpClient = httpClient;
        _endpointResolver = endpointResolver;
        _options = options.Value;
    }

    /// <inheritdoc />
    public async Task<KeycloakUserRoleAssignmentResult> EnsureRealmRoleAssignedAsync(
        string userSubject,
        string roleName,
        CancellationToken cancellationToken = default)
    {
        var adminToken = await GetAdminAccessTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(adminToken))
        {
            return KeycloakUserRoleAssignmentResult.Failure("Keycloak admin token could not be acquired.");
        }

        using var roleMappingsRequest = CreateAdminRequest(
            HttpMethod.Get,
            _endpointResolver.GetAdminUserRealmRoleMappingsUri(userSubject),
            adminToken);

        using var roleMappingsResponse = await _httpClient.SendAsync(roleMappingsRequest, cancellationToken);
        var roleMappingsPayload = await roleMappingsResponse.Content.ReadAsStringAsync(cancellationToken);

        if (!roleMappingsResponse.IsSuccessStatusCode)
        {
            return KeycloakUserRoleAssignmentResult.Failure(BuildFailureDetail(
                roleMappingsResponse.StatusCode,
                "Keycloak user role mappings could not be read.",
                roleMappingsPayload));
        }

        using (var document = JsonDocument.Parse(roleMappingsPayload))
        {
            if (document.RootElement.ValueKind == JsonValueKind.Array &&
                document.RootElement.EnumerateArray().Any(element =>
                    string.Equals(GetOptionalString(element, "name"), roleName, StringComparison.OrdinalIgnoreCase)))
            {
                return KeycloakUserRoleAssignmentResult.Success(alreadyAssigned: true);
            }
        }

        using var roleRequest = CreateAdminRequest(
            HttpMethod.Get,
            _endpointResolver.GetAdminRealmRoleUri(roleName),
            adminToken);

        using var roleResponse = await _httpClient.SendAsync(roleRequest, cancellationToken);
        var rolePayload = await roleResponse.Content.ReadAsStringAsync(cancellationToken);

        if (!roleResponse.IsSuccessStatusCode)
        {
            return KeycloakUserRoleAssignmentResult.Failure(BuildFailureDetail(
                roleResponse.StatusCode,
                $"Keycloak realm role '{roleName}' could not be resolved.",
                rolePayload));
        }

        var roleRepresentation = JsonSerializer.Deserialize<KeycloakRealmRoleRepresentation>(rolePayload, SerializerOptions);
        if (roleRepresentation is null ||
            string.IsNullOrWhiteSpace(roleRepresentation.Id) ||
            string.IsNullOrWhiteSpace(roleRepresentation.Name))
        {
            return KeycloakUserRoleAssignmentResult.Failure("Keycloak returned an invalid realm role representation.");
        }

        using var assignRequest = CreateAdminRequest(
            HttpMethod.Post,
            _endpointResolver.GetAdminUserRealmRoleMappingsUri(userSubject),
            adminToken);

        assignRequest.Content = JsonContent.Create(
            new[]
            {
                roleRepresentation
            },
            options: SerializerOptions);

        using var assignResponse = await _httpClient.SendAsync(assignRequest, cancellationToken);
        var assignPayload = await assignResponse.Content.ReadAsStringAsync(cancellationToken);

        return assignResponse.IsSuccessStatusCode
            ? KeycloakUserRoleAssignmentResult.Success(alreadyAssigned: false)
            : KeycloakUserRoleAssignmentResult.Failure(BuildFailureDetail(
                assignResponse.StatusCode,
                "Keycloak role assignment failed.",
                assignPayload));
    }

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private async Task<string?> GetAdminAccessTokenAsync(CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, _endpointResolver.GetTokenEndpointUri())
        {
            Content = new FormUrlEncodedContent(
            [
                KeyValuePair.Create("grant_type", "client_credentials"),
                KeyValuePair.Create("client_id", _options.ClientId),
                KeyValuePair.Create("client_secret", _options.ClientSecret)
            ])
        };

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        using var document = JsonDocument.Parse(payload);
        return GetOptionalString(document.RootElement, "access_token");
    }

    private static HttpRequestMessage CreateAdminRequest(HttpMethod method, Uri uri, string accessToken)
    {
        var request = new HttpRequestMessage(method, uri);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return request;
    }

    private static string BuildFailureDetail(System.Net.HttpStatusCode statusCode, string prefix, string payload)
    {
        var suffix = string.IsNullOrWhiteSpace(payload)
            ? string.Empty
            : $" Response: {payload}";

        return $"{prefix} Status: {(int)statusCode}.{suffix}";
    }

    private static string? GetOptionalString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) ? value.GetString() : null;
}

/// <summary>
/// Minimal Keycloak realm-role representation used for user-role mapping calls.
/// </summary>
/// <param name="Id">Role identifier.</param>
/// <param name="Name">Role name.</param>
internal sealed record KeycloakRealmRoleRepresentation(string Id, string Name);
