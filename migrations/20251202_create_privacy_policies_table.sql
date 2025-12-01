-- Create privacy_policies table to store policy content
CREATE TABLE IF NOT EXISTS `privacy_policies` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `content` TEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert a default record if table is empty
INSERT INTO `privacy_policies` (`content`, `active`)
SELECT 'Default privacy policy. Please update via admin interface.', 1
WHERE NOT EXISTS (SELECT 1 FROM `privacy_policies` LIMIT 1);
