# Rivals Arena

Site de esports com ranking, times, comunidades, chat e campeonatos mata-mata. A interface usa HTML, CSS e JavaScript. O servidor usa Node.js, Express e MySQL.

## Como abrir no Windows

1. Use o Node.js 24 ou mais recente e inicie o serviço MySQL 8. Se estiver usando o ZIP, extraia em uma pasta nova.
2. Abra a pasta `rivals-arena` que contém o `package.json`. Digite `cmd` na barra de endereço do Explorador de Arquivos e pressione Enter.
3. Execute uma linha por vez no Prompt de Comando.

   ```cmd
   npm install
   copy .env.example .env
   notepad .env
   ```

4. Em `.env`, coloque a senha do seu MySQL em `DB_PASSWORD`. Deixe o campo vazio se o usuário do MySQL não tiver senha.

   ```ini
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=rivals_arena
   DB_PORT=3306
   PORT=3000
   ```

5. Para um banco novo, crie as tabelas com `npm run db:init`. Para trazer seus dados do SQLite, execute em seguida:

   ```cmd
   npm run db:seed -- "C:/caminho/para/rivals_arena.db"
   ```

   A importação é opcional. O script também aceita `SQLITE_PATH` no `.env` e procura o arquivo na pasta `bancodedados` do projeto ou em `Documents/RivalsArenabase/bancodedados`. Use `db:seed` apenas com tabelas vazias. Se `rivals_arena` já tiver os dados que você quer usar, siga para o próximo passo. Para manter as duas versões com bases distintas, configure um nome diferente em `DB_NAME` antes de criar as tabelas.

6. Execute `npm start` e abra [http://localhost:3000](http://localhost:3000). Mantenha o Prompt aberto enquanto usar o site. Se a porta 3000 estiver ocupada, ajuste `PORT` no `.env` e use a mesma porta no navegador.

## Como publicar no Render com os dados atuais

1. Crie uma instância **TiDB Cloud Starter** no plano **Free** com compatibilidade **MySQL**. Para usar a região Virginia do `render.yaml`, escolha AWS US East (N. Virginia) se disponível no TiDB. Em **Connect → Public**, gere a senha e copie o host, a porta e o nome de usuário completo fornecido pelo TiDB. [Criar instância Starter](https://docs.pingcap.com/tidbcloud/create-tidb-cluster-serverless/?plan=starter)

2. Na pasta `rivals-arena`, abra `.env.render`. Se o arquivo ainda não existir, rode `Copy-Item .env.render.example .env.render` no PowerShell. Preencha `DB_HOST`, `DB_USER` e `DB_PASSWORD` usando os valores do TiDB. Confira `DB_PORT`, normalmente `4000`, e mantenha `DB_NAME=rivals_arena` e `DB_TLS=true`. O arquivo `.env` continua apontando para o MySQL local. O Git ignora os dois arquivos.

3. Com o MySQL local ligado, pare as alterações no site local e rode `npm.cmd run db:migrate`. O comando cria as tabelas no destino se necessário, lê uma cópia consistente do MySQL local e confere os valores das nove tabelas antes de confirmar a gravação. O destino precisa estar vazio. Contas, IDs, datas e vínculos entre registros são preservados. A interface mantém as regras atuais de acesso, incluindo a leitura pública do ranking, dos perfis e das mensagens das comunidades.

4. Envie o conteúdo da pasta `rivals-arena` para um repositório **privado** no GitHub, com `render.yaml` na raiz. No Render, escolha **New → Blueprint**, conecte o repositório e informe `DB_HOST`, `DB_USER` e `DB_PASSWORD` a partir da conexão na nuvem. O Blueprint cria um **Web Service Free** com `npm ci` para compilar e `npm start` para iniciar. Confira a porta e o nome do banco no Blueprint caso tenha escolhido valores diferentes. [Primeiro deploy no Render](https://render.com/docs/your-first-deploy)

5. Quando o deploy ficar **Live**, abra o endereço `onrender.com`. Confira o ranking, o acesso com uma conta que já funciona localmente e os campeonatos importados. Para restringir o acesso ao banco, adicione os intervalos em **Connect → Outbound** do Render aos **Authorized Networks** do TiDB antes de remover a regra ampla. [IPs de saída do Render](https://render.com/docs/outbound-ip-addresses) · [Firewall do TiDB](https://docs.pingcap.com/tidbcloud/configure-serverless-firewall-rules-for-public-endpoints/?plan=starter)

Use os planos Free e deixe as contas sem cartão e com a cobrança por consumo desativada. O Render suspende o serviço depois de 15 minutos sem tráfego e a primeira visita pode demorar cerca de um minuto. Como a sessão fica em memória, o visitante precisa entrar novamente após uma reinicialização. O TiDB Starter gratuito tem 5 GiB de armazenamento de linhas e 50 milhões de unidades de operação por mês. [Limites do Render Free](https://render.com/docs/free) · [Cotas do TiDB Cloud Starter](https://docs.pingcap.com/tidbcloud/serverless-limitations/)

## Primeiros passos no site

- Abra **Ranking** e clique no nickname de um jogador para ver pontuação, times e histórico.
- Use **Sua conta → Cadastre-se** para criar um acesso. As 80 contas anteriores continuam no ranking e nos perfis. Elas têm um valor compartilhado no campo de senha e o site recusa o login com esse valor. A recuperação automática exige um fluxo de verificação de identidade e um canal de envio ainda indisponíveis.
- Em **Times**, crie um time. O capitão já entra no elenco e pode adicionar outros usuários pelo nickname. Escolha um mínimo de 2 a 4 jogadores e um máximo entre o mínimo selecionado e 10. Durante um campeonato em andamento, o elenco dos times inscritos fica bloqueado.
- Em **Comunidades**, escolha um grupo e clique em **Entrar na comunidade** para escrever. O chat apresenta até 100 mensagens recentes e consulta atualizações a cada quatro segundos enquanto a aba estiver visível.
- Em **Campeonatos**, crie um torneio para se tornar seu organizador. Os capitães podem inscrever times elegíveis enquanto houver vagas. Escolha um mínimo de 8 a 14 times e um máximo entre o mínimo selecionado e 16. Ao iniciar, as inscrições fecham e o sistema sorteia os confrontos. Com uma quantidade irregular de equipes, algumas avançam diretamente para a rodada seguinte. O organizador registra placares sem empate e o chaveamento avança ao concluir a rodada. Cada vitória vale 25 pontos para os membros do time vencedor e o título soma mais 100. As contas antigas continuam como organizadoras dos campeonatos existentes, que podem ser acompanhados publicamente.
- **Jogo Parceiro** abre a busca por Nekomancia no itch.io. Quando tiver o endereço exato do jogo, coloque-o em `PARTNER_URL` no arquivo `.env` e reinicie o servidor. Os ícones do rodapé levam aos sites do Instagram, Google e TikTok.

## Onde editar

| Arquivo | O que contém |
| --- | --- |
| `public/index.html` | Página inicial. Os demais arquivos HTML em `public/` correspondem às outras páginas. |
| `public/styles.css` | Paleta, dimensões, componentes e regras para desktop, tablet e celular. |
| `public/js/app.js` | Telas, formulários, filtros, chamadas à API e geração de avatares, escudos e capas. |
| `server.js` | Configuração do Express e entrega das páginas e respostas da API. |
| `api.js` | Regras de negócio, validação, consultas ao MySQL e transações. |
| `database.js` | Conexões e transações com `mysql2/promise`. |
| `sql/schema.sql` | Definição das nove tabelas InnoDB. |
| `scripts/db.js` | Criação das tabelas, importação do SQLite e migração do MySQL local. |
| `security.js` | Hash das senhas e sessão em cookie. Ao reiniciar o servidor, entre novamente. |

## Dados e testes

O projeto não inclui uma cópia dos usuários ou do banco. Em uso normal, as operações gravam no banco MySQL definido em `DB_NAME`. O importador lê o SQLite em modo somente leitura e preserva os dados, IDs, datas e relacionamentos.

O histórico usa os vínculos atuais em `membro_time`, conforme a estrutura disponível. A tabela de partidas permite guardar apenas uma chave estrangeira para uma partida anterior. Os dois times classificados são preenchidos na próxima partida e o vínculo aponta para uma das partidas de origem.

Para testar a integração, configure a conexão e o caminho do SQLite. A suíte cria e remove um esquema temporário separado de `DB_NAME`, compara as nove tabelas importadas com o SQLite e testa as operações do site.

```cmd
set TEST_MYSQL=1
npm test
set TEST_MYSQL=
```
