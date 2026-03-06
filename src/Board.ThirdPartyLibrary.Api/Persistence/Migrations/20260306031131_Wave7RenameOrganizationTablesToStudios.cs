using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Board.ThirdPartyLibrary.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Wave7RenameOrganizationTablesToStudios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "organizations",
                newName: "studios");

            migrationBuilder.RenameTable(
                name: "organization_memberships",
                newName: "studio_memberships");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "studios",
                newName: "organizations");

            migrationBuilder.RenameTable(
                name: "studio_memberships",
                newName: "organization_memberships");
        }
    }
}
