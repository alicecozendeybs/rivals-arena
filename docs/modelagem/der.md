# DER do esquema implementado

O diagrama abaixo foi elaborado a partir do [script de criação das tabelas](../../arquivos-adicionais/sql/02-criar-tabelas.sql). As imagens do brModelo na [pasta de modelagem](README.md) registram os modelos originais do projeto.

```mermaid
erDiagram
    direction TB

    usuario ||..o{ time : "lidera"
    usuario ||..o{ comunidade : "cria"
    usuario ||..o{ campeonato : "organiza"
    usuario ||--o{ membro_time : "integra equipes"
    time ||--o{ membro_time : "tem membros"
    usuario ||--o{ membro_comunidade : "participa"
    comunidade ||--o{ membro_comunidade : "tem membros"
    usuario ||..o{ mensagem_chat : "escreve"
    comunidade ||..o{ mensagem_chat : "recebe mensagens"
    campeonato ||--o{ inscricao : "recebe inscrições"
    time ||--o{ inscricao : "se inscreve"
    campeonato ||..o{ partida : "contém partidas"
    time ||..o{ partida : "joga como time 1"
    time ||..o{ partida : "joga como time 2"
    time |o..o{ partida : "vence"
    partida |o..o{ partida : "é a origem de"

    usuario {
        int id_usuario PK
        varchar(100) nome
        varchar(50) nickname UK
        varchar(100) email UK
        varchar(255) senha_hash
        int pontos_ranking
        datetime criado_em
    }
    time {
        int id_time PK
        varchar(100) nome_time UK
        varchar(10) tag UK
        int min_jogadores
        int max_jogadores
        datetime criado_em
        int id_capitao FK
    }
    comunidade {
        int id_comunidade PK
        varchar(100) nome UK
        text descricao
        int min_membros
        int max_membros
        datetime criado_em
        int id_criador FK
    }
    campeonato {
        int id_campeonato PK
        varchar(100) nome
        varchar(50) jogo
        int min_times
        int max_times
        varchar(50) formato
        datetime(3) data_inicio
        varchar(20) status
        int id_organizador FK
    }
    membro_time {
        int fk_usuario_id_usuario PK, FK
        int fk_time_id_time PK, FK
        datetime data_ingresso
    }
    membro_comunidade {
        int fk_usuario_id_usuario PK, FK
        int fk_comunidade_id_comunidade PK, FK
        datetime data_ingresso
    }
    mensagem_chat {
        int id_mensagem PK
        text conteudo
        datetime enviado_em
        int fk_usuario_id_usuario FK
        int fk_comunidade_id_comunidade FK
    }
    inscricao {
        int fk_campeonato_id_campeonato PK, FK
        int fk_time_id_time PK, FK
        datetime data_inscricao
    }
    partida {
        int id_partida PK
        int placar_time1
        int placar_time2
        int rodada
        int fk_partida_id_partida FK
        int fk_campeonato_id_campeonato FK
        int id_time1 FK
        int id_time2 FK
        int id_vencedor FK
    }
```

`PK` indica chave primária, `FK` indica chave estrangeira e `UK` indica campo único. As tabelas `membro_time`, `membro_comunidade` e `inscricao` usam chaves primárias compostas para evitar vínculos repetidos.

Cada partida referencia os dois times e o campeonato. `id_vencedor` é preenchido quando o organizador registra o resultado. `fk_partida_id_partida` pode apontar para uma partida de origem do chaveamento.
