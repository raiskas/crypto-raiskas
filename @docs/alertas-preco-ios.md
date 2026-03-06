# Alertas de Preço por Ativo (iOS + Supabase)

## Checkpoint de retomada (05/03/2026)

Este bloco é a referência oficial para continuar exatamente do ponto atual quando a conta Apple Developer for liberada.

### Status atual

- ✅ Migration aplicada no Supabase com sucesso (`price_alerts` e `device_tokens` criadas).
- ✅ Extensões ativas no banco: `pg_cron`, `pg_net`, `pgcrypto`.
- ✅ Job do cron criado e ativo:
  - `jobname`: `price-alert-engine-every-minute`
  - `schedule`: `*/1 * * * *`
  - `active`: `true`
- ✅ Edge Function publicada:
  - `price-alert-engine`
  - projeto: `lccneuonbuzagjjtaipp`
- ⏳ Pendente: configuração dos secrets APNs no Supabase (aguardando liberação da conta Apple Developer).

### O que falta para concluir push iOS

1. Criar/obter chave APNs no Apple Developer:
   - `APNS_KEY_ID`
   - arquivo `.p8` (conteúdo para `APNS_PRIVATE_KEY`)
2. Definir `CRON_SECRET` (segredo forte).
3. Rodar `supabase secrets set` com os valores finais.
4. Validar disparo ponta a ponta (engine -> push -> deep link Alertas).

### Valores já confirmados no projeto

- `APNS_BUNDLE_ID`: `com.raiskas.ios`
- `APNS_TEAM_ID`: `79KY2ARRTR`
- `PROJECT_REF`: `lccneuonbuzagjjtaipp`

### Comando de retomada (primeiro comando quando liberar a conta)

```bash
supabase secrets set \
  CRON_SECRET="<GERAR_OPENSSL_RAND_HEX_32>" \
  APNS_TEAM_ID="79KY2ARRTR" \
  APNS_KEY_ID="<APPLE_APNS_KEY_ID>" \
  APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<CONTEUDO_P8>\n-----END PRIVATE KEY-----" \
  APNS_BUNDLE_ID="com.raiskas.ios"
```

Depois, validar job:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'price-alert-engine-every-minute';
```

E validar função manualmente:

```bash
supabase functions invoke price-alert-engine --project-ref lccneuonbuzagjjtaipp --no-verify-jwt
```

## Escopo implementado

- Botão **Alertas** no **Painel Administrativo** (iOS).
- Tela **Alertas de Preço** com:
  - listagem
  - criação
  - edição
  - exclusão
  - ativar/desativar
  - direção do gatilho (`>=` / `<=`)
  - preço alvo
  - cooldown em minutos
- Monitoramento server-side via **Supabase Edge Function** (`price-alert-engine`).
- Estrutura de cron via `pg_cron` + `pg_net` (agendamento manual com SQL).
- Registro de device token APNs no Supabase (`device_tokens`).
- Roteamento por push para abrir app em **Alertas** e destacar alerta/ativo.

## Arquivos principais

### iOS

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/App/CryptoRaiskasIOSApp.swift`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/App/AppState.swift`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/App/MainTabView.swift`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/App/AppContract.swift`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/Features/Admin/AdminRootView.swift`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/Core/Models.swift`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/apps/ios/CryptoRaiskasIOS/Sources/Core/SupabaseService.swift`

### Supabase

- `/Users/claudioraikasfh/Desktop/crypto-raiskas/supabase/migrations/20260304110000_add_price_alerts_and_device_tokens.sql`
- `/Users/claudioraikasfh/Desktop/crypto-raiskas/supabase/functions/price-alert-engine/index.ts`

---

## Banco de dados

### Tabela `price_alerts`

Campos principais:

- `usuario_id`
- `asset_symbol`
- `provider_asset_id` (opcional)
- `direction` (`gte`/`lte`)
- `target_price`
- `enabled`
- `is_triggered`
- `cooldown_minutes`
- `last_price`
- `last_triggered_at`
- `next_eligible_at`
- `triggered_count`

### Tabela `device_tokens`

Campos principais:

- `usuario_id`
- `platform` (`ios`)
- `token`
- `apns_environment` (`sandbox`/`production`)
- `ativo`
- `last_seen_at`

### RLS

Foi aplicado RLS para `price_alerts` e `device_tokens` com vínculo por usuário autenticado:

- `usuarios.auth_id = auth.uid()`

---

## Deploy (Supabase CLI)

No diretório do projeto:

```bash
cd /Users/claudioraikasfh/Desktop/crypto-raiskas
```

1. Linkar projeto (se necessário):

```bash
supabase link --project-ref <PROJECT_REF>
```

2. Aplicar migrations:

```bash
supabase db push
```

3. Deploy da function:

```bash
supabase functions deploy price-alert-engine
```

4. Configurar secrets da function:

```bash
supabase secrets set \
  CRON_SECRET="<SECRET_FOR_CRON_AUTH>" \
  APNS_TEAM_ID="<APPLE_TEAM_ID>" \
  APNS_KEY_ID="<APPLE_KEY_ID>" \
  APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" \
  APNS_BUNDLE_ID="com.raiskas.ios"
```

Opcional para teste local da function:

```bash
supabase functions serve price-alert-engine
```

---

## Agendamento (pg_cron + pg_net)

Depois do deploy da function, agendar execução (exemplo: a cada 1 minuto):

```sql
-- remova agenda antiga, se existir
select cron.unschedule('price-alert-engine-every-minute');

-- crie nova agenda
select cron.schedule(
  'price-alert-engine-every-minute',
  '*/1 * * * *',
  $$
  select
    net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/price-alert-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <CRON_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Observação: usar o mesmo valor de `<CRON_SECRET>` cadastrado em `supabase secrets`.

---

## APNs (iOS)

No Xcode target iOS:

1. **Signing & Capabilities**:
   - Add Capability: **Push Notifications**
   - Add Capability: **Background Modes** (opcional para cenários avançados; para tap em push não é obrigatório)

2. Bundle ID no Apple Developer deve bater com `APNS_BUNDLE_ID` no Supabase.

3. Chave APNs (`.p8`) deve ser convertida para texto e salva em `APNS_PRIVATE_KEY`.

---

## Fluxo de push implementado

1. iOS pede permissão de notificação após autenticação.
2. iOS registra APNs token.
3. iOS faz upsert do token na tabela `device_tokens`.
4. Engine server-side avalia alertas por ciclo.
5. Quando dispara:
   - atualiza `price_alerts`
   - envia push APNs
6. Ao tocar push:
   - app seleciona tab **Admin**
   - abre **Alertas**
   - destaca o alerta/ativo recebido.

---

## Teste ponta a ponta

1. Criar alerta iOS:
   - ativo: `BTC`
   - direção: `<=`
   - alvo: valor acima do preço atual para forçar disparo rápido em teste
2. Confirmar token salvo:

```sql
select * from device_tokens order by updated_at desc limit 5;
```

3. Executar function manualmente:

```bash
supabase functions invoke price-alert-engine --no-verify-jwt
```

ou via SQL `net.http_post`.

4. Verificar atualização do alerta:

```sql
select id, asset_symbol, is_triggered, last_price, last_triggered_at, next_eligible_at
from price_alerts
order by updated_at desc
limit 20;
```

5. Confirmar push no iPhone e navegação para **Alertas**.

---

## Observações de robustez

- Sem polling contínuo no iOS.
- Engine agrupa por `asset_symbol/provider_asset_id` (1 fetch por ativo por ciclo).
- Cache curto em memória na function.
- Deduplicação por `is_triggered` + `next_eligible_at` + `cooldown_minutes`.
- Tokens inválidos são desativados (`ativo=false`) em respostas APNs `400/410`.
