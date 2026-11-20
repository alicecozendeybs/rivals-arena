# Rivals Arena

O Rivals Arena é um sistema web de esports que reúne perfis de jogadores, times, comunidades com chat, campeonatos mata-mata e ranking.

[Acessar o site publicado](https://rivals-arena.onrender.com/) · [Código-fonte no GitHub](https://github.com/alicecozendeybs/rivals-arena)

## Objetivo

Facilitar a organização de campeonatos de esports. Jogadores podem formar equipes e participar de comunidades. Capitães inscrevem os times, organizadores registram os resultados e o público acompanha o chaveamento e a evolução do ranking.

## Funcionalidades

- **Contas e perfis** — cadastro, login, sessão e consulta ao perfil de jogador com pontuação, times e histórico de partidas.
- **Ranking** — classificação dos jogadores pela pontuação acumulada em campeonatos.
- **Times** — criação de equipes com capitão e limites de elenco, além de inclusão e remoção de membros pelo capitão.
- **Comunidades e chat** — criação de grupos, entrada em comunidades e envio de mensagens pelos membros.
- **Campeonatos** — inscrição de times, sorteio de confrontos, registro de placares e avanço automático das equipes vencedoras no mata-mata. A vitória rende 25 pontos aos jogadores do time vencedor e o título soma mais 100.
- **Jogo Parceiro** — acesso à página do jogo por um link configurável.

## Tecnologias utilizadas

| Área | Tecnologias |
| --- | --- |
| Interface | HTML5, CSS3 e JavaScript |
| Servidor e API | Node.js 24 ou superior e Express 5 |
| Banco de dados | MySQL 8 no ambiente local e TiDB Cloud Starter em produção, com conexão via `mysql2` |
| Publicação | Render Web Service Free e GitHub |

## Modelagem do banco de dados

O banco relacional `rivals_arena` tem nove tabelas. Chaves estrangeiras ligam os usuários aos times e às comunidades, e ligam os times aos campeonatos e às partidas.

| Tabela | Dados que armazena |
| --- | --- |
| `usuario` | Contas, nicknames, hashes de senha e pontos de ranking. |
| `time` | Equipes, capitães e limites de elenco. |
| `comunidade` | Grupos, criadores e limites de membros. |
| `campeonato` | Torneios, organizadores, datas, formato e status. |
| `membro_time` | Vínculos entre jogadores e times. |
| `membro_comunidade` | Vínculos entre usuários e comunidades. |
| `mensagem_chat` | Mensagens, autores, comunidades e horários. |
| `inscricao` | Vínculos entre times e campeonatos. |
| `partida` | Confrontos, rodadas, placares, vencedores e referência à partida de origem. |

Os modelos conceitual e lógico e o Diagrama Entidade–Relacionamento (DER) estão na [documentação da modelagem](docs/modelagem/README.md).

## Instalação e uso

O [guia de instalação e uso](arquivos-adicionais/instalacao-e-uso.md) explica como configurar o MySQL, instalar as dependências, executar o servidor e testar as funcionalidades. Para avaliar o projeto sem instalação local, abra o [site publicado](https://rivals-arena.onrender.com/).

Os scripts para preparar o banco são arquivos de texto com extensão `.sql` e ficam em [`arquivos-adicionais/sql/`](arquivos-adicionais/sql/).

1. [`01-criar-banco.sql`](arquivos-adicionais/sql/01-criar-banco.sql) — cria e seleciona o banco `rivals_arena`.
2. [`02-criar-tabelas.sql`](arquivos-adicionais/sql/02-criar-tabelas.sql) — cria as tabelas, chaves e restrições.
3. [`03-inserir-dados-exemplo.sql`](arquivos-adicionais/sql/03-inserir-dados-exemplo.sql) — insere dados fictícios para testar o sistema em uma instalação local.

## Estrutura do repositório

| Local | Conteúdo |
| --- | --- |
| `public/` | Páginas, estilos, scripts de interface e imagens. |
| `server.js` e `api.js` | Servidor HTTP, rotas da API e regras do sistema. |
| `database.js` e `security.js` | Conexões, transações, hashes de senha e sessões. |
| `scripts/db.js` | Inicialização, importação de SQLite e migração de MySQL. |
| `docs/modelagem/` | Arquivos editáveis e versões para visualização da modelagem. |
| `arquivos-adicionais/` | Scripts SQL e guia de instalação e uso. |
| `render.yaml` | Configuração do serviço publicado no Render. |
