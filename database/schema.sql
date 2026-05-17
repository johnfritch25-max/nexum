-- ============================================================
-- Messenger App — Full Database Setup
-- Import this file directly into Laragon / HeidiSQL
--
-- HOW TO IMPORT IN LARAGON:
--   1. Open HeidiSQL from Laragon
--   2. Connect (root, no password by default)
--   3. File → Run SQL file → select this file
--   4. Done ✓
--
-- Demo accounts created at the bottom:
--   alice   / Password1!
--   bob     / Password1!
--   charlie / Password1!
-- ============================================================

-- ── Create & select the database ─────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS `messenger_db`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `messenger_db`;

-- ── Create the app user (optional — skip if using root) ──────────────────────
-- If you want a dedicated user instead of root, uncomment these lines:
-- CREATE USER IF NOT EXISTS 'messenger_user'@'localhost' IDENTIFIED BY 'messenger_pass';
-- GRANT ALL PRIVILEGES ON `messenger_db`.* TO 'messenger_user'@'localhost';
-- FLUSH PRIVILEGES;

-- ── Drop tables in safe order ─────────────────────────────────────────────────

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `friends`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE `users` (
    `id`                    BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `username`              VARCHAR(32)         NOT NULL,
    `display_name`          VARCHAR(64)         NOT NULL,
    `email`                 VARCHAR(255)        NOT NULL,

    -- bcrypt hash (cost 12) — never store plaintext passwords
    `password_hash`         CHAR(60)            NOT NULL,

    `avatar_url`            VARCHAR(512)        NULL DEFAULT NULL,
    `bio`                   VARCHAR(300)        NULL DEFAULT NULL,

    `online_status`         ENUM(
                                'online',
                                'idle',
                                'do_not_disturb',
                                'offline'
                            )                   NOT NULL DEFAULT 'offline',

    -- Live activity — NULL when incognito or no app detected
    `current_status_icon`   VARCHAR(16)         NULL DEFAULT NULL,
    `current_status_text`   VARCHAR(128)        NULL DEFAULT NULL,

    -- When 1, server suppresses all activity broadcasts for this user
    `is_incognito`          TINYINT(1)          NOT NULL DEFAULT 0,

    `last_seen_at`          DATETIME            NULL DEFAULT NULL,
    `created_at`            DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_username`       (`username`),
    UNIQUE KEY `uq_users_email`          (`email`),
    INDEX      `idx_users_online_status` (`online_status`),
    INDEX      `idx_users_incognito`     (`is_incognito`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Core user accounts with credentials and live activity state';


-- ============================================================
-- TABLE: refresh_tokens
-- Stores bcrypt-hashed refresh tokens for JWT rotation.
-- Supports multiple active sessions per user (multi-device).
-- ============================================================
CREATE TABLE `refresh_tokens` (
    `id`            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `user_id`       BIGINT UNSIGNED     NOT NULL,
    `token_hash`    VARCHAR(60)         NOT NULL,
    `expires_at`    DATETIME            NOT NULL,
    `created_at`    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    FOREIGN KEY `fk_refresh_user` (`user_id`)
        REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_refresh_user_expires` (`user_id`, `expires_at`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Hashed refresh tokens for JWT rotation';


-- ============================================================
-- TABLE: friends
-- Bidirectional friendship graph.
-- Convention: user_id_1 < user_id_2 (enforced at app layer).
-- ============================================================
CREATE TABLE `friends` (
    `id`            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `user_id_1`     BIGINT UNSIGNED     NOT NULL,
    `user_id_2`     BIGINT UNSIGNED     NOT NULL,
    `requester_id`  BIGINT UNSIGNED     NOT NULL,
    `status`        ENUM(
                        'pending',
                        'accepted',
                        'blocked'
                    )                   NOT NULL DEFAULT 'pending',
    `created_at`    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_friends_pair`         (`user_id_1`, `user_id_2`),
    FOREIGN KEY `fk_friends_user1`      (`user_id_1`)    REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY `fk_friends_user2`      (`user_id_2`)    REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY `fk_friends_requester`  (`requester_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_friends_user_id_1`        (`user_id_1`, `status`),
    INDEX `idx_friends_user_id_2`        (`user_id_2`, `status`),
    INDEX `idx_friends_requester`        (`requester_id`)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Bidirectional friend relationships with pending/accepted/blocked lifecycle';


-- ============================================================
-- TABLE: messages
-- ============================================================
CREATE TABLE `messages` (
    `id`            BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
    `sender_id`     BIGINT UNSIGNED     NOT NULL,
    `receiver_id`   BIGINT UNSIGNED     NOT NULL,

    -- Deterministic room key: lower_id_higher_id e.g. "1_2"
    `room_id`       VARCHAR(64)         NOT NULL,

    -- 'text' for regular messages, 'image' for base64 image data URLs
    `message_type`  ENUM('text','image') NOT NULL DEFAULT 'text',

    `content`       MEDIUMTEXT          NOT NULL,
    `is_edited`     TINYINT(1)          NOT NULL DEFAULT 0,
    `is_deleted`    TINYINT(1)          NOT NULL DEFAULT 0,
    `read_at`       DATETIME            NULL DEFAULT NULL,
    `created_at`    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`    DATETIME(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    FOREIGN KEY `fk_messages_sender`   (`sender_id`)   REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY `fk_messages_receiver` (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_messages_room_created`  (`room_id`, `created_at` DESC),
    INDEX `idx_messages_receiver_read` (`receiver_id`, `read_at`),
    INDEX `idx_messages_sender`        (`sender_id`, `created_at` DESC)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Direct messages between users — text and image support';


-- ============================================================
-- TABLE: posts  (Community Hub)
-- ============================================================
CREATE TABLE IF NOT EXISTS `posts` (
    `id`           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `author_id`    BIGINT UNSIGNED  NOT NULL,
    `content`      VARCHAR(2000)    NOT NULL,
    `image_url`    MEDIUMTEXT       NULL DEFAULT NULL,
    `is_deleted`   TINYINT(1)       NOT NULL DEFAULT 0,
    `created_at`   DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`   DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    FOREIGN KEY `fk_posts_author` (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_posts_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: post_reactions
-- ============================================================
CREATE TABLE IF NOT EXISTS `post_reactions` (
    `id`         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `post_id`    BIGINT UNSIGNED  NOT NULL,
    `user_id`    BIGINT UNSIGNED  NOT NULL,
    `emoji`      VARCHAR(8)       NOT NULL DEFAULT '❤️',
    `created_at` DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_reaction` (`post_id`, `user_id`, `emoji`),
    FOREIGN KEY `fk_reaction_post` (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_reaction_user` (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE: post_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS `post_comments` (
    `id`         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `post_id`    BIGINT UNSIGNED  NOT NULL,
    `author_id`  BIGINT UNSIGNED  NOT NULL,
    `content`    VARCHAR(1000)    NOT NULL,
    `is_deleted` TINYINT(1)       NOT NULL DEFAULT 0,
    `created_at` DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    FOREIGN KEY `fk_comment_post`   (`post_id`)   REFERENCES `posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY `fk_comment_author` (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_comments_post` (`post_id`, `created_at` ASC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--
-- All three accounts use password:  Password1!
-- Hash generated with bcrypt cost factor 10.
--
-- You can log in immediately with:
--   username: alice   password: Password1!
--   username: bob     password: Password1!
--   username: charlie password: Password1!
-- ============================================================

INSERT INTO `users`
    (`username`, `display_name`, `email`, `password_hash`, `online_status`)
VALUES
    (
        'alice',
        'Alice Nguyen',
        'alice@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'offline'
    ),
    (
        'bob',
        'Bob Okafor',
        'bob@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'offline'
    ),
    (
        'charlie',
        'Charlie Smith',
        'charlie@example.com',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'offline'
    );

-- Alice and Bob are already friends so you can test chat immediately
INSERT INTO `friends`
    (`user_id_1`, `user_id_2`, `requester_id`, `status`)
VALUES
    (1, 2, 1, 'accepted');
