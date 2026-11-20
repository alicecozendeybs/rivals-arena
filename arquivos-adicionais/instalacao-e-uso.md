# Instalação e uso do Rivals Arena

O [site publicado](https://rivals-arena.onrender.com/) pode ser usado direto pelo navegador. O passo a passo abaixo prepara uma instalação local no Windows com um banco próprio.

## 1. Preparar o ambiente

- Instale o **Node.js 24 ou superior**, com npm, e o **MySQL Server 8**. Deixe o serviço MySQL ligado.
- Baixe o código pelo menu **Code → Download ZIP** no [GitHub](https://github.com/alicecozendeybs/rivals-arena) e extraia o arquivo, ou clone o repositório com Git.
- Abra o PowerShell na pasta que contém `package.json`.

```powershell
npm.cmd ci
Copy-Item .env.example .env
notepad .env
```

Se você já tiver um `.env` com a configuração local, pule a linha `Copy-Item`. No arquivo `.env`, preencha o usuário e a senha do seu MySQL. Ajuste a porta se a instalação usar outro valor.

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD="sua-senha-do-mysql"
DB_NAME=rivals_arena
DB_TLS=false
PORT=3000
```

Os arquivos `.env.example` e `.env.render.example` são modelos. Guarde a configuração real nos arquivos locais ignorados pelo Git.

## 2. Criar e popular o banco

Execute o comando abaixo para criar o banco e suas nove tabelas.

```powershell
npm.cmd run db:init
```

Para fazer a criação pelo **MySQL Workbench**, abra a conexão do seu MySQL local e execute [`01-criar-banco.sql`](sql/01-criar-banco.sql). Selecione `rivals_arena` como o esquema padrão e execute [`02-criar-tabelas.sql`](sql/02-criar-tabelas.sql).

Em uma instalação local nova, você pode executar [`03-inserir-dados-exemplo.sql`](sql/03-inserir-dados-exemplo.sql) no mesmo esquema. O script preenche o ranking e cria equipes, uma comunidade com mensagem e um campeonato com inscrições abertas. As contas fictícias servem para visualizar os dados. Faça seu cadastro pelo site para testar login e formulários.

Se você já tiver o banco SQLite original do projeto e quiser importá-lo, use o comando abaixo com as tabelas vazias. A importação preserva IDs, datas e relacionamentos. Use o arquivo original como fonte em vez dos dados fictícios de exemplo.

```powershell
npm.cmd run db:seed -- "C:/caminho/para/rivals_arena.db"
```

## 3. Iniciar o site

```powershell
npm.cmd start
```

Mantenha o terminal aberto e acesse [http://localhost:3000](http://localhost:3000). Se a porta 3000 estiver ocupada, altere `PORT` no `.env`, reinicie o servidor e abra a nova porta. Use **Ctrl+C** no terminal para encerrar o servidor.

## 4. Usar e testar as funcionalidades

| Área | Como testar |
| --- | --- |
| **Sua conta** | Clique em **Cadastre-se**, crie uma conta e confirme que consegue sair e entrar de novo. Contas antigas importadas com senha legada bloqueada aparecem nos perfis e no ranking. |
| **Ranking** | Abra a classificação e clique no nickname de um jogador para ver o perfil, os times e o histórico. |
| **Times** | Crie um time. O criador entra como capitão e pode adicionar jogadores pelo nickname. O elenco de equipes inscritas fica bloqueado durante um campeonato em andamento. |
| **Comunidades** | Crie um grupo ou abra um existente. Use **Entrar na comunidade** para habilitar o envio de mensagens. |
| **Campeonatos** | Crie um torneio. Capitães podem inscrever equipes elegíveis. Ao atingir o mínimo definido, o organizador pode iniciar o mata-mata e registrar placares sem empate. O ranking recebe os pontos conforme os resultados. |
| **Jogo Parceiro** | O botão abre a busca por Nekomancia no itch.io até `PARTNER_URL` receber o endereço HTTPS do jogo. |

## Verificar os dados e executar os testes

Os formulários da instalação local gravam no banco definido em `DB_NAME`. Para conferir os cadastros no MySQL Workbench, execute esta consulta após criar um usuário.

```sql
SELECT id_usuario, nickname, criado_em
FROM rivals_arena.usuario
ORDER BY id_usuario DESC
LIMIT 10;
```

Para executar a suíte de integração, configure o MySQL e tenha o arquivo SQLite original. A suíte cria um banco temporário para comparar a importação e testar os fluxos do site.

```powershell
$env:SQLITE_PATH = 'C:/caminho/para/rivals_arena.db'
$env:TEST_MYSQL = '1'
npm.cmd test
Remove-Item Env:TEST_MYSQL, Env:SQLITE_PATH
```

## Publicação no Render

O ambiente público usa **Render Web Service Free** e uma instância **TiDB Cloud Starter** compatível com MySQL. O [`render.yaml`](../render.yaml) configura `npm ci`, `npm start`, conexão TLS com o banco e cookies seguros. O [site está publicado neste endereço](https://rivals-arena.onrender.com/).

Para preparar outra publicação com dados locais, crie uma instância Starter com limite mensal de US$ 0. Preencha `.env.render` com o host, a porta, o usuário e a senha do TiDB, usando `.env.render.example` como referência. Com o MySQL local ligado, execute `npm.cmd run db:migrate` para inicializar o banco de destino e copiar as nove tabelas. O destino deve estar vazio.

No Render, conecte o repositório em **New → Blueprint**. Preencha `DB_HOST`, `DB_USER` e `DB_PASSWORD` no painel. Se for atualizar o link do jogo parceiro, adicione `PARTNER_URL` em **Environment** e use **Save and deploy**. A primeira visita após um período sem tráfego pode demorar enquanto o serviço gratuito inicia. [Configuração do Render](https://render.com/docs/configure-environment-variables) · [Limites do plano gratuito](https://render.com/docs/free)
