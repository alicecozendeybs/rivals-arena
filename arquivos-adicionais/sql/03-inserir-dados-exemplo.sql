-- Dados fictícios para uma instalação local de demonstração.
-- Selecione o banco local antes de executar este arquivo.
-- As contas de exemplo aparecem no site. Crie sua própria conta para acessar os formulários.
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO usuario (nome, nickname, email, senha_hash, pontos_ranking)
VALUES
    ('Ana Demo', 'demo_ana', 'demo-ana@example.test', 'demonstracao-sem-login', 150),
    ('Bruno Demo', 'demo_bruno', 'demo-bruno@example.test', 'demonstracao-sem-login', 125),
    ('Clara Demo', 'demo_clara', 'demo-clara@example.test', 'demonstracao-sem-login', 100),
    ('Davi Demo', 'demo_davi', 'demo-davi@example.test', 'demonstracao-sem-login', 75)
ON DUPLICATE KEY UPDATE id_usuario = usuario.id_usuario;

INSERT INTO `time` (nome_time, tag, min_jogadores, max_jogadores, id_capitao)
SELECT 'Órbita Demo', 'DXORB', 2, 5, id_usuario
FROM usuario
WHERE email = 'demo-ana@example.test'
UNION ALL
SELECT 'Cometa Demo', 'DXCMT', 2, 5, id_usuario
FROM usuario
WHERE email = 'demo-clara@example.test'
ON DUPLICATE KEY UPDATE id_time = `time`.id_time;

INSERT INTO membro_time (fk_time_id_time, fk_usuario_id_usuario)
SELECT t.id_time, u.id_usuario
FROM `time` AS t
JOIN usuario AS u
    ON (t.tag = 'DXORB' AND u.email IN ('demo-ana@example.test', 'demo-bruno@example.test'))
    OR (t.tag = 'DXCMT' AND u.email IN ('demo-clara@example.test', 'demo-davi@example.test'))
ON DUPLICATE KEY UPDATE data_ingresso = membro_time.data_ingresso;

INSERT INTO comunidade (nome, descricao, min_membros, max_membros, id_criador)
SELECT 'Comunidade Demo', 'Grupo fictício para testar a área de comunidades.', 1, 20, id_usuario
FROM usuario
WHERE email = 'demo-ana@example.test'
ON DUPLICATE KEY UPDATE id_comunidade = comunidade.id_comunidade;

INSERT INTO membro_comunidade (fk_usuario_id_usuario, fk_comunidade_id_comunidade)
SELECT u.id_usuario, c.id_comunidade
FROM usuario AS u
JOIN comunidade AS c ON c.nome = 'Comunidade Demo'
WHERE u.email IN ('demo-ana@example.test', 'demo-bruno@example.test')
ON DUPLICATE KEY UPDATE data_ingresso = membro_comunidade.data_ingresso;

INSERT INTO mensagem_chat (conteudo, fk_usuario_id_usuario, fk_comunidade_id_comunidade)
SELECT 'Bem-vindos à comunidade de demonstração!', u.id_usuario, c.id_comunidade
FROM usuario AS u
JOIN comunidade AS c ON c.nome = 'Comunidade Demo'
WHERE u.email = 'demo-ana@example.test'
    AND NOT EXISTS (
        SELECT 1 FROM mensagem_chat AS m
        WHERE m.fk_usuario_id_usuario = u.id_usuario
            AND m.fk_comunidade_id_comunidade = c.id_comunidade
            AND m.conteudo = 'Bem-vindos à comunidade de demonstração!'
    );

INSERT INTO campeonato (nome, jogo, min_times, max_times, formato, data_inicio, status, id_organizador)
SELECT 'Copa Rivals Demo', 'Jogo de demonstração', 8, 16, 'Mata-Mata (Eliminação Simples)',
       UTC_TIMESTAMP() + INTERVAL 7 DAY, 'Inscrições Abertas', u.id_usuario
FROM usuario AS u
WHERE u.email = 'demo-clara@example.test'
    AND NOT EXISTS (
        SELECT 1 FROM campeonato AS c
        WHERE c.id_organizador = u.id_usuario AND c.nome = 'Copa Rivals Demo'
    );

INSERT INTO inscricao (fk_campeonato_id_campeonato, fk_time_id_time)
SELECT c.id_campeonato, t.id_time
FROM campeonato AS c
JOIN usuario AS u ON u.id_usuario = c.id_organizador
JOIN `time` AS t ON t.tag IN ('DXORB', 'DXCMT')
WHERE c.nome = 'Copa Rivals Demo' AND u.email = 'demo-clara@example.test'
ON DUPLICATE KEY UPDATE data_inscricao = inscricao.data_inscricao;

COMMIT;
