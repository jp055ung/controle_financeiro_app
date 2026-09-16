# NaCarteira — pacote de atualização

## Como aplicar
Substitua no seu repositório, mantendo os mesmos caminhos, os arquivos abaixo:

```
package.json
server/index.ts
index.html
client/src/App.tsx
client/src/index.css
public/manifest.json
public/sw.js
public/icons/icon-16.png   (novo)
public/icons/icon-32.png   (novo)
public/icons/icon-180.png  (novo)
public/icons/icon-192.png  (substitui o antigo)
public/icons/icon-512.png  (substitui o antigo)
public/brand/logo-mark.png      (novo)
public/brand/logo-wordmark.png  (novo)
```

Se o seu repo tinha um `sw.js` solto na raiz (fora de `public/`), pode apagá-lo — ele nunca era
servido de fato (o Vite só copia o que está em `public/`), então era um arquivo morto.

## ⚠️ Passo obrigatório no Railway (fora do código)
O chat inteligente só funciona com a variável de ambiente `ANTHROPIC_API_KEY` configurada no
serviço do Railway (Settings → Variables). Sem ela, o app continua funcionando normalmente,
mas o chat responde avisando que a IA não está configurada. Nenhuma outra mudança de
plataforma é necessária — é só isso.

## O que mudou nesta rodada

### 1. Chat inteligente (novo)
- Novo endpoint `POST /api/ai/parse-transaction` no backend: recebe um texto livre + userId,
  manda pro Claude (modelo `claude-haiku-4-5-20251001`, mesmo já usado nos insights) com um
  prompt que já resolve datas relativas ("sexta passada", "ontem") e categoriza o gasto nos
  6 potes, devolvendo um JSON estruturado.
- Novo componente `SmartChat` no frontend: uma caixa de chat compacta que fica no topo do
  Dashboard. O usuário escreve do jeito que contaria pra um amigo ("sexta fui ao cinema,
  gastei 100 no ingresso e 59 na pipoca") e o app:
  1. Manda o texto pro backend, que devolve os lançamentos identificados;
  2. Insere cada um usando os mesmos endpoints que os modais manuais já usavam (nada de
     lógica duplicada — reaproveita validação, XP e cálculo de categoria existentes);
  3. Responde no chat confirmando o que foi registrado (com XP ganho).
- Se o texto não tiver nenhum valor identificável, o assistente pede pra reformular — não
  trava nem insere lixo.
- Os modais manuais de despesa/renda continuam existindo (abas Despesas/Renda) — o chat é a
  porta de entrada rápida, não substitui os recursos atuais.

### 2. Visual mais limpo
- Trocado o ícone/logo genérico de moeda (SVG "$") e o texto "MONEYGAME" (gradiente
  arco-íris) pela sua marca real (NaCarteira) em todos os pontos: tela de intro, login,
  esqueci-senha, sidebar desktop, header mobile, ícone do PWA/favicon.
- O card de "Conte seu gasto ou ganho" (chat) substituiu visualmente o par de botões +
  banner que ficava solto no topo do Dashboard — menos elementos competindo por atenção,
  fluxo mais direto.
- Banner de apoio ("Apoie o NaCarteira") mantido, só reposicionado logo abaixo do chat.

### 3. Coisas que NÃO mudei nesta rodada (fica pra próxima etapa, como combinado)
- Menu em gaveta / reorganização de navegação.
- Renomear "Relatórios" para "Raio-X" com tom de coach (Paulo Vieira).
- Chat inteligente também para lançamentos de cartão de crédito (hoje cobre gastos e
  ganhos, que foi o que você pediu por último).

Se quiser, sigo pra essas próximas etapas.
