-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 25, 2025 at 12:21 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `gcorganizedb_new`
--

-- --------------------------------------------------------

--
-- Table structure for table `attendance_records`
--

CREATE TABLE `attendance_records` (
  `id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `attended_at` datetime DEFAULT current_timestamp(),
  `scanned_by_org_id` int(11) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance_records`
--

INSERT INTO `attendance_records` (`id`, `event_id`, `student_id`, `attended_at`, `scanned_by_org_id`, `deleted_at`, `deleted_by`) VALUES
(26, 69, '202211223', '2025-08-25 16:03:22', 2, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `certificates`
--

CREATE TABLE `certificates` (
  `id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `event_id` int(11) NOT NULL,
  `certificate_url` text DEFAULT NULL,
  `certificate_public_id` varchar(255) DEFAULT NULL,
  `generated_at` datetime DEFAULT current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `created_events`
--

CREATE TABLE `created_events` (
  `event_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `event_poster` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by_org_id` int(11) DEFAULT NULL,
  `created_by_osws_id` int(11) DEFAULT NULL,
  `status` enum('not yet started','ongoing','concluded','cancelled') DEFAULT 'not yet started',
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `created_events`
--

INSERT INTO `created_events` (`event_id`, `title`, `description`, `location`, `start_date`, `start_time`, `end_date`, `end_time`, `event_poster`, `created_at`, `created_by_org_id`, `created_by_osws_id`, `status`, `deleted_at`, `deleted_by`) VALUES
(69, 'ELITES Shoot the Pong!', '🔥 The ELITES Booth is Here! 🔥 \r\nGet ready to aim, shoot, and sip at APERTURA 2025!\r\n🏓 SHOOT DA PONG – Show us your skills and win some mini prizes!\r\n🥤 ICE-COLD BEVERAGES – Chill with our refreshing drinks!\r\n🎲 And MORE GAMES – Fun surprises await, specially made for first-years!\r\n📍 Find us at Room 411\r\n📅 Don’t miss out – we’re open during the event hours! \r\nWhether you\'re here to flex your pong game or just need a quick refresh, the ELITES booth has got you covered. Swing by, have fun, and support your fellow tech champs! 💚\r\n✨ See you there!\r\n#GCCCSELITES \r\n#Paglalayag2025 \r\n#GCApertura2025 ', 'GC Main 411', '2025-08-20', '08:00:00', '2025-08-20', '17:00:00', 'https://res.cloudinary.com/dzuwygoya/image/upload/v1755577617/event-posters/event-poster-1755577615294-404341926.webp', '2025-08-19 04:26:58', 2, NULL, 'not yet started', NULL, NULL),
(70, 'JPIA Fun Cup Twist!', 'AUGUST - 𝗔𝗽𝗲𝗿𝘁𝘂𝗿𝗮 𝟮𝟬𝟮𝟱 ♥️♦️♠️♣️\r\n\r\n𝘐-𝘴𝘩𝘰𝘰𝘵 𝘮𝘰, 𝘐-𝘴𝘩𝘰𝘰𝘵 𝘮𝘰, 𝘐-𝘴𝘩𝘰𝘰𝘵 𝘮𝘰 𝘯𝘢 𝘢𝘯𝘨 𝘣𝘢𝘭𝘭~ ☄️\r\n\r\nHey there, Elites! Ready to toss, answer, and WIN? 🎯\r\n\r\nJoin the fun, test your skills and knowledge at House of Accounts: Welcome to the Game, and we\'ve got you the perfect mix of twist. 🎢\r\n\r\nDon\'t miss the FUN CUP TWIST!\r\n\r\n🗓️ August 11, 8am - 5pm\r\n📍Room 202, Gordon College Annex Building\r\n\r\nSee yah, and bet it all, JPIAns! 🙌🏼\r\n\r\n#JPIAGC\r\n#gordoncollege\r\n#SY2526', 'GC Annex 202', '2025-08-21', '08:00:00', '2025-08-21', '17:00:00', 'https://res.cloudinary.com/dzuwygoya/image/upload/v1755577801/event-posters/event-poster-1755577799797-428089635.webp', '2025-08-19 04:30:03', 3, NULL, 'not yet started', NULL, NULL),
(71, 'Amazing World of IONS', '\"𝙏𝙝𝙚 𝙨𝙩𝙖𝙧𝙨 𝙖𝙡𝙞𝙜𝙣 𝙞𝙣 𝙩𝙝𝙚 𝙨𝙥𝙖𝙘𝙚 𝙖𝙣𝙙 𝙜𝙖𝙡𝙖𝙭𝙮.\"\r\nThe 𝐈𝐧𝐭𝐞𝐫𝐚𝐜𝐭𝐢𝐯𝐞 𝐎𝐫𝐠𝐚𝐧𝐢𝐳𝐚𝐭𝐢𝐨𝐧 𝐨𝐟 𝐍𝐚𝐭𝐮𝐫𝐚𝐥 𝐒𝐜𝐢𝐞𝐧𝐜𝐞𝐬 (𝐈𝐎𝐍𝐒) cordially invites you to our much-awaited 𝐀𝐩𝐞𝐫𝐭𝐮𝐫𝐚 𝟐𝟎𝟐𝟓 with the theme: \"𝐀 𝐕𝐨𝐲𝐚𝐠𝐞 𝐨𝐟 𝐈𝐧𝐧𝐨𝐯𝐚𝐭𝐢𝐨𝐧, 𝐈𝐧𝐜𝐥𝐮𝐬𝐢𝐨𝐧, 𝐚𝐧𝐝, 𝐈𝐦𝐩𝐚𝐜𝐭\"\r\n🗓️ 𝐃𝐚𝐭𝐞: 𝐀𝐮𝐠𝐮𝐬𝐭 𝟏𝟏, 𝟐𝟎𝟐𝟓\r\n🕖 𝐓𝐢𝐦𝐞: 𝟕:𝟎𝟎 𝐀𝐌\r\n🌌 𝐁𝐨𝐨𝐭𝐡 𝐓𝐢𝐭𝐥𝐞: 𝐓𝐡𝐞 𝐀𝐦𝐚𝐳𝐢𝐧𝐠 𝐖𝐨𝐫𝐥𝐝 𝐨𝐟 𝐈𝐎𝐍𝐒\r\n📍 𝐕𝐞𝐧𝐮𝐞: 𝐑𝐨𝐨𝐦 𝟒24, 𝟒𝐭𝐡 𝐅𝐥𝐨𝐨𝐫\r\nAs the 𝐮𝐧𝐢𝐯𝐞𝐫𝐬𝐞 continue to expand, so does our 𝐩𝐮𝐫𝐬𝐮𝐢𝐭 𝐨𝐟 𝐤𝐧𝐨𝐰𝐥𝐞𝐝𝐠𝐞. This year\'s 𝐀𝐩𝐞𝐫𝐭𝐮𝐫𝐚 marks not only  the beginning of another 𝐚𝐜𝐚𝐝𝐞𝐦𝐢𝐜 𝐣𝐨𝐮𝐫𝐧𝐞𝐲 but also a renewed commintment to making 𝐬𝐜𝐢𝐞𝐧𝐜𝐞 more 𝐢𝐧𝐜𝐥𝐮𝐬𝐢𝐯𝐞, 𝐢𝐧𝐧𝐨𝐯𝐚𝐭𝐢𝐯𝐞, and  𝐢𝐦𝐩𝐚𝐜𝐭𝐟𝐮𝐥. This gathering serves as a reminer that in unity, our organization will continue to 𝐞𝐯𝐨𝐥𝐯𝐞, 𝐢𝐧𝐬𝐩𝐢𝐫𝐞, and 𝐛𝐫𝐞𝐚𝐤 𝐛𝐨𝐮𝐧𝐝𝐚𝐫𝐢𝐞𝐬.\r\nLet this event be a 𝐜𝐨𝐬𝐦𝐢𝐜 𝐬𝐩𝐚𝐫𝐤—a chance to connect in the universE of 𝐥𝐞𝐚𝐫𝐧𝐢𝐧𝐠 and 𝐥𝐞𝐚𝐝𝐞𝐫𝐬𝐡𝐢𝐩, 𝐭𝐨 𝐬𝐡𝐚𝐫𝐞 𝐬𝐭𝐨𝐫𝐢𝐞𝐬, 𝐢𝐠𝐧𝐢𝐭𝐞 𝐢𝐝𝐞𝐚𝐬, 𝐚𝐧𝐝 𝐛𝐮𝐢𝐥𝐝 𝐦𝐞𝐚𝐧𝐢𝐧𝐠𝐟𝐮𝐥 𝐛𝐨𝐧𝐝𝐬 that go beyond in the 𝐜𝐨𝐬𝐦𝐨𝐬.\r\n𝐅𝐞𝐚𝐭𝐮𝐫𝐞𝐝 𝐆𝐚𝐦𝐞𝐬 :\r\n𝐈-𝐬𝐡𝐨𝐨𝐭 𝐦𝐨, 𝐁𝐚𝐛𝐲!: Players are given three rings to throw, with the goal of landing them over bottles arranged on a table or designated area. The  challenge is to successfully get all three rings to land around the bottles. Those who complete the challenge will win a prize, which may include merchandise items or other exciting rewards.\r\n𝟐 𝐓𝐫𝐮𝐭𝐡𝐬 𝐚𝐧𝐝 𝟏 𝐋𝐢𝐞: During gameplay, the player is presented with three statements—two truths and one lie. The goal is to correctly identify which of the three statements is false. Each player or group has three chances to play, but they are only allowed one incorrect guess for the entire round. Players who successfully identify the lie in at least two out of the three sets will earn a point, which can be collected and later redeemed for prizes.\r\n𝐃𝐢𝐜𝐞 𝐌𝐞 𝐚𝐧𝐝 𝐀𝐧𝐬𝐰𝐞𝐫 𝐌𝐞: Roll the dice and choose one number from your roll (even if repeated). Each number (1–6) matches a box filled with slips containing a science question and a dare. Pick one slip from the chosen box. Answer correctly to earn a point, or complete the dare. Points can be exchanged for prizes!\r\n📌  𝐀𝐥𝐥 𝐨𝐟 𝐭𝐡𝐞𝐬𝐞 𝐠𝐚𝐦𝐞𝐬 𝐡𝐚𝐯𝐞 𝐚 𝐫𝐞𝐠𝐢𝐬𝐭𝐫𝐚𝐭𝐢𝐨𝐧 𝐟𝐞𝐞 𝐨𝐟 𝐨𝐧𝐥𝐲 𝐏𝐡𝐩 𝟏𝟎.\r\n𝘈𝘴 𝘸𝘦 𝘦𝘮𝘣𝘢𝘳𝘬 𝘰𝘯 𝘵𝘩𝘪𝘴 𝘴𝘩𝘢𝘳𝘦𝘥 𝘷𝘰𝘺𝘢𝘨𝘦, 𝘮𝘢𝘺 𝘸𝘦 𝘤𝘰𝘯𝘵𝘪𝘯𝘶𝘦 𝘵𝘰 𝘭𝘰𝘰𝘬 𝘶𝘱, 𝘥𝘳𝘦𝘢𝘮 𝘣𝘪𝘨, 𝘢𝘯𝘥 𝘣𝘦𝘭𝘪𝘦𝘷𝘦 𝘵𝘩𝘢𝘵 𝘸𝘦 𝘢𝘳𝘦 𝘢𝘭𝘭 𝘤𝘰𝘯𝘯𝘦𝘤𝘵𝘦𝘥 𝘪𝘯 𝘵𝘩𝘦 𝘶𝘯𝘪𝘷𝘦𝘳𝘴𝘦 𝘰𝘧 𝘴𝘤𝘪𝘦𝘯𝘤𝘦, 𝘥𝘪𝘴𝘤𝘰𝘷𝘦𝘳𝘺, 𝘢𝘯𝘥 𝘩𝘰𝘱𝘦.\r\n𝙈𝙖𝙮 𝙋𝙤𝙬𝙚𝙧 𝙤𝙛 𝙎𝙘𝙞𝙚𝙣𝙘𝙚 𝘾𝙤𝙢𝙥𝙚𝙡 𝙔𝙤𝙪.\r\n#IONSCommunity\r\n#Apertura2025', 'GC Main 424', '2025-08-22', '08:00:00', '2025-08-23', '17:00:00', 'https://res.cloudinary.com/dzuwygoya/image/upload/v1755578024/event-posters/event-poster-1755578023003-193173436.webp', '2025-08-19 04:33:45', 4, NULL, 'not yet started', NULL, NULL),
(76, 'test event', 'test desc', 'test location', '2025-08-26', '08:00:00', '2025-08-27', '17:00:00', 'https://res.cloudinary.com/dzuwygoya/image/upload/v1756094222/event-posters/event-poster-1756094222451-755537514.webp', '2025-08-25 03:57:04', 2, NULL, 'not yet started', '2025-08-25 18:13:10', 2),
(78, 'osws event ', 'osws test desc', 'test loc', '2025-08-26', '08:00:00', '2025-08-27', '17:00:00', NULL, '2025-08-25 05:56:44', NULL, 1, 'not yet started', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `event_registrations`
--

CREATE TABLE `event_registrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `event_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `proof_of_payment` text DEFAULT NULL,
  `proof_of_payment_public_id` varchar(255) DEFAULT NULL,
  `qr_code` text DEFAULT NULL,
  `qr_code_public_id` varchar(255) DEFAULT NULL,
  `registered_at` datetime DEFAULT current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_registrations`
--

INSERT INTO `event_registrations` (`id`, `event_id`, `student_id`, `proof_of_payment`, `proof_of_payment_public_id`, `qr_code`, `qr_code_public_id`, `registered_at`, `deleted_at`, `deleted_by`) VALUES
(68, 69, '202211223', NULL, NULL, 'https://res.cloudinary.com/dzuwygoya/image/upload/v1756108947/qr-codes/registration_68.png', 'qr-codes/registration_68', '2025-08-25 16:02:27', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `osws_admins`
--

CREATE TABLE `osws_admins` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` text NOT NULL,
  `name` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `osws_admins`
--

INSERT INTO `osws_admins` (`id`, `email`, `password_hash`, `name`) VALUES
(1, 'gc_osws@gordoncollege.edu.ph', '$2b$10$MePs2bRjqONWLUkeZn6LFu1MQL03c5h66xUxjA3Z/SdQfmKI2rS7O', 'Office of Student Welfare and Services');

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` varchar(20) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `middle_initial` char(1) DEFAULT NULL,
  `suffix` varchar(10) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `program` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`id`, `email`, `password_hash`, `first_name`, `last_name`, `middle_initial`, `suffix`, `department`, `program`, `created_at`) VALUES
('202210212', '202210212@gordoncollege.edu.ph', '$2a$12$ro3SR8aenTIq1SAH.jYy4OTtvHU1obkMZS.nYIxwCF83sAXiqqJym', 'Lee Leighnard', 'Jose', NULL, NULL, 'CEAS', 'BSED', '2025-08-25 09:25:11'),
('202210888', '202210888@gordoncollege.edu.ph', '$2b$10$LyCbX4ywkOccZba2M7lvf.lGqrQolQhFraivFGj8mYHhB2p/cIR.W', 'Angelo Syrean', 'Bonifacio', 'B', NULL, 'CAHS', 'BSN', '2025-05-21 04:27:07'),
('202211223', '202211223@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Brian Gabriel', 'Gonzales', 'E', '', 'CCS', 'BSIT', '2025-05-21 04:18:16');

-- --------------------------------------------------------

--
-- Table structure for table `student_organizations`
--

CREATE TABLE `student_organizations` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `org_name` varchar(255) NOT NULL,
  `department` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student_organizations`
--

INSERT INTO `student_organizations` (`id`, `email`, `org_name`, `department`, `password_hash`, `created_at`) VALUES
(2, 'gcccs.elites@gordoncollege.edu.ph', 'GCCCS ELITES', 'CCS', '$2b$10$Ji6j3elC8CpAwa/JFioBnOnF5faYcelyOAnSpEYxCIYzmqOcAywsW', '2025-05-21 04:54:25'),
(3, 'gccba.jpia@gordoncollege.edu.ph', 'GCCBA JPIA', 'CBA', '$2b$10$C3BfJH1ccaTWvyinPEza7egfz6XNAEukf09god9sbkjPFf4SdhPf2', '2025-05-21 15:48:06'),
(4, 'gcceas.ions@gordoncollege.edu.ph', 'GCCEAS IONS', 'CEAS', '$2b$10$/9hnrmncjIvbKfSXSc7dKuMerOinfSF99UMNlDa0X.yqv8Qa8F7HK', '2025-05-21 16:22:28');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`),
  ADD KEY `scanned_by_org_id` (`scanned_by_org_id`),
  ADD KEY `attendance_records_ibfk_2` (`student_id`),
  ADD KEY `idx_attendance_records_deleted_at` (`deleted_at`);

--
-- Indexes for table `certificates`
--
ALTER TABLE `certificates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`),
  ADD KEY `certificates_ibfk_1` (`student_id`),
  ADD KEY `idx_certificates_deleted_at` (`deleted_at`);

--
-- Indexes for table `created_events`
--
ALTER TABLE `created_events`
  ADD PRIMARY KEY (`event_id`),
  ADD KEY `created_by_org_id` (`created_by_org_id`),
  ADD KEY `created_by_osws_id` (`created_by_osws_id`),
  ADD KEY `idx_created_events_deleted_at` (`deleted_at`);

--
-- Indexes for table `event_registrations`
--
ALTER TABLE `event_registrations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`),
  ADD KEY `event_registrations_ibfk_2` (`student_id`),
  ADD KEY `idx_event_registrations_deleted_at` (`deleted_at`);

--
-- Indexes for table `osws_admins`
--
ALTER TABLE `osws_admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `student_organizations`
--
ALTER TABLE `student_organizations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance_records`
--
ALTER TABLE `attendance_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `certificates`
--
ALTER TABLE `certificates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `created_events`
--
ALTER TABLE `created_events`
  MODIFY `event_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `event_registrations`
--
ALTER TABLE `event_registrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT for table `osws_admins`
--
ALTER TABLE `osws_admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `student_organizations`
--
ALTER TABLE `student_organizations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD CONSTRAINT `attendance_records_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `created_events` (`event_id`),
  ADD CONSTRAINT `attendance_records_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  ADD CONSTRAINT `attendance_records_ibfk_3` FOREIGN KEY (`scanned_by_org_id`) REFERENCES `student_organizations` (`id`);

--
-- Constraints for table `certificates`
--
ALTER TABLE `certificates`
  ADD CONSTRAINT `certificates_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  ADD CONSTRAINT `certificates_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `created_events` (`event_id`);

--
-- Constraints for table `created_events`
--
ALTER TABLE `created_events`
  ADD CONSTRAINT `created_events_ibfk_1` FOREIGN KEY (`created_by_org_id`) REFERENCES `student_organizations` (`id`),
  ADD CONSTRAINT `created_events_ibfk_2` FOREIGN KEY (`created_by_osws_id`) REFERENCES `osws_admins` (`id`);

--
-- Constraints for table `event_registrations`
--
ALTER TABLE `event_registrations`
  ADD CONSTRAINT `event_registrations_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `created_events` (`event_id`),
  ADD CONSTRAINT `event_registrations_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
