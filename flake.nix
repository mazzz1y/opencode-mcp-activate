{
  description = "opencode plugin exposing an mcp_activate tool that starts disabled MCP servers on demand";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;

      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAllSystems = f: lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      packageJson = lib.importJSON ./package.json;

      runtimeFiles = lib.fileset.unions [
        ./index.js
        ./prompts.js
        ./package.json
      ];

      mkPackage =
        pkgs:
        pkgs.stdenvNoCC.mkDerivation {
          pname = packageJson.name;
          inherit (packageJson) version;

          src = lib.fileset.toSource {
            root = ./.;
            fileset = runtimeFiles;
          };

          dontBuild = true;

          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp index.js prompts.js package.json $out/
            runHook postInstall
          '';

          meta = {
            inherit (packageJson) description;
            homepage = lib.removeSuffix "#readme" packageJson.homepage;
            license = lib.licenses.mit;
            platforms = lib.platforms.all;
          };
        };
    in
    {
      overlays.default = final: _prev: { opencode-mcp-activate = mkPackage final; };

      packages = forAllSystems (pkgs: rec {
        opencode-mcp-activate = mkPackage pkgs;
        default = opencode-mcp-activate;
      });

      checks = forAllSystems (pkgs: {
        package = self.packages.${pkgs.stdenv.hostPlatform.system}.default;

        test =
          pkgs.runCommandLocal "opencode-mcp-activate-test"
            {
              nativeBuildInputs = [ pkgs.nodejs ];
              src = lib.fileset.toSource {
                root = ./.;
                fileset = lib.fileset.unions [
                  runtimeFiles
                  ./test
                ];
              };
            }
            ''
              cd $src
              node --test
              touch $out
            '';
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShellNoCC { packages = [ pkgs.nodejs ]; };
      });

      formatter = forAllSystems (pkgs: pkgs.nixfmt);
    };
}
