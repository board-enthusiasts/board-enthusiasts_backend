namespace Board.ThirdPartyLibrary.Api.Auth;

/// <summary>
/// Assigns realm roles to Keycloak users.
/// </summary>
internal interface IKeycloakUserRoleClient
{
    /// <summary>
    /// Ensures the supplied realm role is assigned to the supplied Keycloak user.
    /// </summary>
    /// <param name="userSubject">Keycloak user subject identifier.</param>
    /// <param name="roleName">Realm role name to ensure.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The role-assignment result.</returns>
    Task<KeycloakUserRoleAssignmentResult> EnsureRealmRoleAssignedAsync(
        string userSubject,
        string roleName,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result returned by <see cref="IKeycloakUserRoleClient"/>.
/// </summary>
/// <param name="Succeeded">Whether the assignment operation succeeded.</param>
/// <param name="AlreadyAssigned">Whether the role was already assigned before the operation.</param>
/// <param name="ErrorDetail">Optional upstream failure detail.</param>
internal sealed record KeycloakUserRoleAssignmentResult(
    bool Succeeded,
    bool AlreadyAssigned,
    string? ErrorDetail)
{
    /// <summary>
    /// Creates a successful role-assignment result.
    /// </summary>
    /// <param name="alreadyAssigned">Whether the role was already assigned.</param>
    /// <returns>The success result.</returns>
    public static KeycloakUserRoleAssignmentResult Success(bool alreadyAssigned) =>
        new(true, alreadyAssigned, null);

    /// <summary>
    /// Creates a failed role-assignment result.
    /// </summary>
    /// <param name="errorDetail">Failure detail.</param>
    /// <returns>The failed result.</returns>
    public static KeycloakUserRoleAssignmentResult Failure(string errorDetail) =>
        new(false, false, errorDetail);
}
