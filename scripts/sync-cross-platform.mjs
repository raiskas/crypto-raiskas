#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes("--check");

const CONTRACT_PATH = path.join(ROOT, "shared", "cross-platform.contract.json");
const WEB_OUT = path.join(ROOT, "src", "lib", "cross-platform-contract.ts");
const MAC_APP_DEST = path.join(
  ROOT,
  "apps",
  "macos",
  "RaiskasMac",
  "Sources",
  "App",
  "AppDestination.swift"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeIfChanged(filePath, content) {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (previous === content) return false;
  if (CHECK_ONLY) return true;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function createWebContractFile(contract) {
  const payload = JSON.stringify(contract, null, 2);
  return `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source: shared/cross-platform.contract.json
// Command: pnpm sync:platforms

export const APP_CONTRACT = ${payload} as const;

export type MainNavItem = (typeof APP_CONTRACT.mainNav)[number];
export type AdminNavItem = (typeof APP_CONTRACT.adminNav)[number];
export type ModalLabelItem = (typeof APP_CONTRACT.modals)[number];
`;
}

function escapeSwift(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function createSwiftContractBlock(contract) {
  const keyToLabel = Object.fromEntries(contract.mainNav.map((item) => [item.key, item.label]));
  const adminKeyToLabel = Object.fromEntries(contract.adminNav.map((item) => [item.key, item.label]));
  const modalKeyToLabel = Object.fromEntries(contract.modals.map((item) => [item.key, item.label]));

  const lines = [
    "enum AppContract {",
    `  static let appName = "${escapeSwift(contract.appName)}"`,
    `  static let adminMenuTitle = "${escapeSwift(contract.adminMenuTitle)}"`,
    "",
    `  static let homeLabel = "${escapeSwift(keyToLabel.home || "Home")}"`,
    `  static let cryptoLabel = "${escapeSwift(keyToLabel.crypto || "Crypto")}"`,
    `  static let carteiraLabel = "${escapeSwift(keyToLabel.carteira || "Carteira")}"`,
    `  static let adminOverviewLabel = "${escapeSwift(adminKeyToLabel.adminOverview || "Visão Geral")}"`,
    `  static let adminUsuariosLabel = "${escapeSwift(adminKeyToLabel.adminUsuarios || "Usuários")}"`,
    `  static let adminEmpresasLabel = "${escapeSwift(adminKeyToLabel.adminEmpresas || "Empresas")}"`,
    "",
    `  static let modalCryptoNewOperationLabel = "${escapeSwift(modalKeyToLabel.cryptoNewOperation || "Crypto • Nova Operação")}"`,
    `  static let modalPortfolioAdminLabel = "${escapeSwift(modalKeyToLabel.portfolioAdmin || "Carteira • Administrar Carteira")}"`,
    `  static let modalAdminNewUserLabel = "${escapeSwift(modalKeyToLabel.adminNewUser || "Admin • Novo Usuário")}"`,
    `  static let modalAdminNewGroupLabel = "${escapeSwift(modalKeyToLabel.adminNewGroup || "Admin • Novo Grupo")}"`,
    `  static let modalAdminNewEmpresaLabel = "${escapeSwift(modalKeyToLabel.adminNewEmpresa || "Admin • Nova Empresa")}"`,
    "}",
  ];
  return lines.join("\n");
}

function injectSwiftContract(contract, swiftPath) {
  const begin = "// BEGIN GENERATED CONTRACT (sync-cross-platform)";
  const end = "// END GENERATED CONTRACT (sync-cross-platform)";
  const source = fs.readFileSync(swiftPath, "utf8");
  const startIndex = source.indexOf(begin);
  const endIndex = source.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Marcadores de bloco gerado não encontrados em ${swiftPath}`);
  }

  const before = source.slice(0, startIndex + begin.length);
  const after = source.slice(endIndex);
  const generated = `\n${createSwiftContractBlock(contract)}\n`;
  return `${before}${generated}${after}`;
}

function main() {
  if (!fs.existsSync(CONTRACT_PATH)) {
    throw new Error(`Contrato não encontrado: ${CONTRACT_PATH}`);
  }

  const contract = readJson(CONTRACT_PATH);
  const pending = [];

  const webContent = createWebContractFile(contract);
  if (writeIfChanged(WEB_OUT, webContent)) pending.push(WEB_OUT);

  const swiftUpdated = injectSwiftContract(contract, MAC_APP_DEST);
  if (writeIfChanged(MAC_APP_DEST, swiftUpdated)) pending.push(MAC_APP_DEST);

  if (CHECK_ONLY) {
    if (pending.length > 0) {
      console.error("Arquivos fora de sincronia:");
      for (const file of pending) console.error(`- ${path.relative(ROOT, file)}`);
      process.exit(1);
    }
    console.log("OK: Web e macOS sincronizados com o contrato compartilhado.");
    return;
  }

  if (pending.length === 0) {
    console.log("Sem alterações. Web e macOS já estavam sincronizados.");
  } else {
    console.log("Sincronização concluída:");
    for (const file of pending) console.log(`- ${path.relative(ROOT, file)}`);
  }
}

main();
