CREATE TABLE IF NOT EXISTS `usuario` (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    nickname VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    pontos_ranking INT DEFAULT 0,
    criado_em DATETIME DEFAULT (UTC_TIMESTAMP())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `time` (
    id_time INT AUTO_INCREMENT PRIMARY KEY,
    nome_time VARCHAR(100) NOT NULL UNIQUE,
    tag VARCHAR(10) NOT NULL UNIQUE,
    min_jogadores INT,
    max_jogadores INT,
    criado_em DATETIME DEFAULT (UTC_TIMESTAMP()),
    id_capitao INT NOT NULL,
    CONSTRAINT FK_time_2 FOREIGN KEY (id_capitao) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `comunidade` (
    id_comunidade INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    min_membros INT,
    max_membros INT,
    criado_em DATETIME DEFAULT (UTC_TIMESTAMP()),
    id_criador INT NOT NULL,
    CONSTRAINT FK_comunidade_2 FOREIGN KEY (id_criador) REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `campeonato` (
    id_campeonato INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    jogo VARCHAR(50) NOT NULL,
    min_times INT,
    max_times INT,
    formato VARCHAR(50),
    data_inicio DATETIME(3),
    status VARCHAR(20),
    id_organizador INT NOT NULL,
    CONSTRAINT FK_campeonato_2 FOREIGN KEY (id_organizador) REFERENCES usuario (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `membro_time` (
    fk_time_id_time INT,
    fk_usuario_id_usuario INT,
    data_ingresso DATETIME DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (fk_usuario_id_usuario, fk_time_id_time),
    CONSTRAINT FK_membro_time_1 FOREIGN KEY (fk_time_id_time) REFERENCES `time` (id_time),
    CONSTRAINT FK_membro_time_2 FOREIGN KEY (fk_usuario_id_usuario) REFERENCES usuario (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `membro_comunidade` (
    fk_usuario_id_usuario INT,
    fk_comunidade_id_comunidade INT,
    data_ingresso DATETIME DEFAULT (UTC_TIMESTAMP()),
    PRIMARY KEY (fk_usuario_id_usuario, fk_comunidade_id_comunidade),
    CONSTRAINT FK_membro_comunidade_1 FOREIGN KEY (fk_usuario_id_usuario) REFERENCES usuario (id_usuario),
    CONSTRAINT FK_membro_comunidade_2 FOREIGN KEY (fk_comunidade_id_comunidade) REFERENCES comunidade (id_comunidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `mensagem_chat` (
    id_mensagem INT AUTO_INCREMENT PRIMARY KEY,
    conteudo TEXT NOT NULL,
    enviado_em DATETIME DEFAULT (UTC_TIMESTAMP()),
    fk_usuario_id_usuario INT NOT NULL,
    fk_comunidade_id_comunidade INT NOT NULL,
    CONSTRAINT FK_mensagem_chat_2 FOREIGN KEY (fk_usuario_id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    CONSTRAINT FK_mensagem_chat_3 FOREIGN KEY (fk_comunidade_id_comunidade) REFERENCES comunidade (id_comunidade) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `inscricao` (
    data_inscricao DATETIME DEFAULT (UTC_TIMESTAMP()),
    fk_campeonato_id_campeonato INT,
    fk_time_id_time INT,
    PRIMARY KEY (fk_campeonato_id_campeonato, fk_time_id_time),
    CONSTRAINT FK_inscricao_2 FOREIGN KEY (fk_campeonato_id_campeonato) REFERENCES campeonato (id_campeonato),
    CONSTRAINT FK_inscricao_3 FOREIGN KEY (fk_time_id_time) REFERENCES `time` (id_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;

CREATE TABLE IF NOT EXISTS `partida` (
    id_partida INT AUTO_INCREMENT PRIMARY KEY,
    placar_time1 INT DEFAULT 0,
    placar_time2 INT DEFAULT 0,
    rodada INT,
    fk_partida_id_partida INT,
    fk_campeonato_id_campeonato INT NOT NULL,
    id_time1 INT NOT NULL,
    id_time2 INT NOT NULL,
    id_vencedor INT,
    CONSTRAINT FK_partida_2 FOREIGN KEY (fk_partida_id_partida) REFERENCES partida (id_partida),
    CONSTRAINT FK_partida_3 FOREIGN KEY (fk_campeonato_id_campeonato) REFERENCES campeonato (id_campeonato) ON DELETE RESTRICT,
    CONSTRAINT FK_partida_4 FOREIGN KEY (id_time1) REFERENCES `time` (id_time),
    CONSTRAINT FK_partida_5 FOREIGN KEY (id_time2) REFERENCES `time` (id_time),
    CONSTRAINT FK_partida_6 FOREIGN KEY (id_vencedor) REFERENCES `time` (id_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin;
