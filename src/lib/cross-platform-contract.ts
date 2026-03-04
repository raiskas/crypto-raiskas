// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
// Source: shared/cross-platform.contract.json
// Command: pnpm sync:platforms

export const APP_CONTRACT = {
  "appName": "Crypto Raiskas",
  "adminMenuTitle": "Painel Administrativo",
  "mainNav": [
    {
      "key": "home",
      "label": "Home",
      "href": "/home"
    },
    {
      "key": "crypto",
      "label": "Crypto",
      "href": "/crypto"
    },
    {
      "key": "carteira",
      "label": "Carteira",
      "href": "/crypto/carteira"
    }
  ],
  "adminNav": [
    {
      "key": "adminOverview",
      "label": "Visão Geral",
      "href": "/admin"
    },
    {
      "key": "adminUsuarios",
      "label": "Usuários",
      "href": "/admin/usuarios"
    },
    {
      "key": "adminEmpresas",
      "label": "Empresas",
      "href": "/admin/empresas"
    }
  ],
  "modals": [
    {
      "key": "cryptoNewOperation",
      "label": "Crypto • Nova Operação"
    },
    {
      "key": "portfolioAdmin",
      "label": "Carteira • Administrar Carteira"
    },
    {
      "key": "adminNewUser",
      "label": "Admin • Novo Usuário"
    },
    {
      "key": "adminNewGroup",
      "label": "Admin • Novo Grupo"
    },
    {
      "key": "adminNewEmpresa",
      "label": "Admin • Nova Empresa"
    }
  ]
} as const;

export type MainNavItem = (typeof APP_CONTRACT.mainNav)[number];
export type AdminNavItem = (typeof APP_CONTRACT.adminNav)[number];
export type ModalLabelItem = (typeof APP_CONTRACT.modals)[number];
