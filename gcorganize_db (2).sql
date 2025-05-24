-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 24, 2025 at 11:21 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `gcorganize_db`
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
  `scanned_by_org_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `certificates`
--

CREATE TABLE `certificates` (
  `id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `event_id` int(11) NOT NULL,
  `certificate_url` text DEFAULT NULL,
  `generated_at` datetime DEFAULT current_timestamp()
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
  `status` enum('not yet started','ongoing','completed','cancelled') DEFAULT 'not yet started'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `created_events`
--

INSERT INTO `created_events` (`event_id`, `title`, `description`, `location`, `start_date`, `start_time`, `end_date`, `end_time`, `event_poster`, `created_at`, `created_by_org_id`, `created_by_osws_id`, `status`) VALUES
(45, 'IONS Poster Making Contest', '𝗖𝗼𝗻𝗴𝗿𝗮𝘁𝘂𝗹𝗮𝘁𝗶𝗼𝗻𝘀 𝘁𝗼 𝗼𝘂𝗿 𝗮𝘄𝗲𝘀𝗼𝗺𝗲 𝗮𝗿𝘁𝗶𝘀𝘁𝘀! 🎉\r\nWe’re thrilled to announce the winners of the Join the Campaign Poster Making Contest in celebration of National Artificial Intelligence Literacy Day!\r\n\r\nWe appreciate everyone’s patience as we carefully reviewed all the amazing entries. With the theme “What is AI for you?”, each piece showcased creativity and deep thought on how AI shapes our lives.\r\nHere are the official results:\r\n\r\n🏆 Champion: 𝗙𝗿𝗮𝗻𝗸𝗵𝗲𝘀𝗶𝗮 𝗔𝗻𝗶𝗸𝗮 𝗦𝗶𝗯𝘂𝗴 — First Year, BSIT\r\n\r\n🥇 First Place: 𝗝𝗮𝗿𝘇𝗲𝗻𝗻 𝗟𝗼𝘃𝗲 𝗠𝗼𝗿𝗮𝗹𝗲𝘀 — Third Year, BSEd Science\r\n\r\n🥈 Second Place: 𝗝𝗮𝘇𝗺𝗶𝗻 𝗦𝗮𝗹𝗶𝗱 — First Year, BSEd Science\r\n\r\nHuge thanks to everyone who joined and poured their heart into their art. You made this contest extra special! All participants will receive an e-certificate via email as a token of appreciation.\r\n\r\n📩 Winners, please message us here on our official Facebook page to claim your prizes and certificates.\r\nKeep creating and inspiring. More events coming soon from IONS!', 'Social Media', '2025-05-24', '11:00:00', '2025-05-25', '17:00:00', 'uploads\\1748055431649.webp', '2025-05-24 02:57:12', 4, NULL, 'ongoing'),
(46, 'GCCCS ELITES Tekken Booth', '⚔️ THE BATTLE FOR SUPREMACY RETURNS! ⚔️\r\nThe third TEKKEN 8: GC Celestial Rivals 2025 tournament is here! Are you ready to prove your dominance in the ring?\r\n🔥February 24-25, 2025 \r\nAs part of Gordon College’s 26th Founding Anniversary, warriors from all around will clash in an intense showdown of skill, strategy, and sheer willpower. Sharpen your combos, unleash your rage arts, and fight your way to the top!\r\n🚨 DLC IS NOT INCLUDED – ADAPT OR FALL! 🚨\r\nProudly organized by ELITES, this tournament promises nothing less than a legendary experience. Registration opens February 8, 2025 – Don’t miss your chance to battle for GLORY! \r\n#TheKingOfIronFist2025', 'Room 508', '2025-05-25', '08:00:00', '2025-05-26', '17:00:00', 'uploads\\1748056295518.webp', '2025-05-24 03:11:35', 2, NULL, 'not yet started'),
(47, '2025 National Women\'s Month', 'As we celebrate National Women\'s Month this March, we proudly embrace the theme, \"Babae sa Lahat ng Sektor, Aangat ang Bukas sa Bagong Pilipinas.\" This year\'s theme emphasizes the vital role of women in every sector of society and underscores our collective commitment to fostering an inclusive and equitable environment.\r\n\r\nWomen are at the forefront of progress, driving change and innovation in various fields—from education and healthcare to business and technology. Their contributions are essential to building a brighter and more sustainable future for our nation.\r\n\r\nThe Office of Student Welfare and Services encourages all students, faculty, and staff to actively participate in celebrating the achievements of women, advocate for gender equality, and work together to create a supportive community that empowers everyone.\r\n\r\nTogether, we can uplift the voices of women and ensure that their rights and contributions are recognized and celebrated. Join us in this important celebration as we strive for a New Philippines where every woman has the opportunity to thrive.\r\n\r\n#WEcanbeEquALL\r\n#NationalWomensMonth', 'Gordon College Grounds', '2025-06-01', '08:00:00', '2025-06-30', '17:00:00', 'uploads\\1748059215258.webp', '2025-05-24 04:00:15', NULL, 1, 'not yet started'),
(48, 'GC Got Talent', '𝙀𝙮𝙚𝙨 𝙝𝙚𝙧𝙚, 𝙂𝘾𝙞𝙖𝙣𝙨!\r\nAs the countdown begins for our 𝟮𝟲𝘁𝗵 𝗙𝗼𝘂𝗻𝗱𝗶𝗻𝗴 𝗔𝗻𝗻𝗶𝘃𝗲𝗿𝘀𝗮𝗿𝘆, we\'re calling on our talented gems to unleash their awe-inspiring acts in the 3rd year of  𝙂𝘾 𝙂𝙤𝙩 𝙏𝙖𝙡𝙚𝙣𝙩! The stage is set soon for where passion meets destiny—are you ready to shine?\r\nRegister here: https://forms.gle/T3dkNVntU5j5DJL3A\r\nThis event is in collaboration with GCCCS Empowered League of Information Technology Education Students.', 'Gordon College Grounds', '2025-05-25', '09:00:00', '2025-05-27', '18:00:00', 'uploads\\1748062145342.webp', '2025-05-24 04:49:05', NULL, 1, 'not yet started'),
(49, 'JPIA Income Tax Workshop', '𝙀𝙡𝙚𝙫𝙖𝙩𝙚 𝙮𝙤𝙪𝙧 𝙆𝙣𝙤𝙬𝙡𝙚𝙙𝙜𝙚: 𝙄𝙣𝙘𝙤𝙢𝙚 𝙏𝙖𝙭 𝙀𝙙𝙞𝙩𝙞𝙤𝙣 📈\r\n\r\n📣✨ We are inviting all accountancy students to participate in an enriching experience in the 𝐂𝐨𝐦𝐩𝐫𝐞𝐡𝐞𝐧𝐬𝐢𝐯𝐞 𝐏𝐞𝐫𝐬𝐩𝐞𝐜𝐭𝐢𝐯𝐞𝐬 𝐨𝐧 𝐈𝐧𝐜𝐨𝐦𝐞 𝐓𝐚𝐱𝐚𝐭𝐢𝐨𝐧. This is a great chance to explore the intricacies of income tax, receive valuable knowledge from experts in the field, and improve your grasp of this vital accounting component. Whether you are a beginner or seeking to enhance your understanding, this workshop guarantees to provide you with useful skills and viewpoints that will be beneficial in your future profession. 💡\r\n\r\n🌐 𝐉𝐨𝐢𝐧 𝐮𝐬 𝐟𝐨𝐫 𝐂𝐨𝐦𝐩𝐫𝐞𝐡𝐞𝐧𝐬𝐢𝐯𝐞 𝐏𝐞𝐫𝐬𝐩𝐞𝐜𝐭𝐢𝐯𝐞𝐬 𝐨𝐧 𝐈𝐧𝐜𝐨𝐦𝐞 𝐓𝐚𝐱𝐚𝐭𝐢𝐨𝐧! 🌟\r\n\r\n🗓️ 𝗗𝗮𝘁𝗲: November 15, 2024\r\n📍 𝗟𝗼𝗰𝗮𝘁𝗶𝗼𝗻: Gordon College Function Hall, 3rd Floor.\r\n⏰ 𝗧𝗶𝗺𝗲: 8:00AM-12:00NN\r\n\r\n🌟 Join us at our income taxation seminar for a valuable and enlightening experience! We look forward to seeing you there. If you have any inquiries, feel free to send us a message. 💼✨\r\n\r\nInterested in joining? Just click the Google Form linked below to sign up! 📋✨\r\nhttps://forms.gle/2fDSWoPTeUURra9G9', 'Function Hall', '2025-05-25', '09:49:00', '2025-05-25', '11:00:00', 'uploads\\1748062223423.webp', '2025-05-24 04:50:23', 3, NULL, 'not yet started'),
(50, 'IONS Carnival', 'Sa letrang 𝐈 – ay iniwan!\r\nSa letrang 𝐎 – okay lang ‘yan dahil mas marami pang kasiyahan!\r\nSa letrang 𝐍 – narito ang mga palarong na inyong aabangan!\r\nSa letrang 𝐒 – sa 𝐈𝐎𝐍𝐒 𝐂𝐀𝐑𝐍𝐈𝐕𝐀𝐋 ika’y iniimbitahan! \r\n  🔥 𝐀𝐛𝐚𝐧𝐠𝐚𝐧 𝐚𝐧𝐠 𝐈𝐎𝐍𝐒 𝐂𝐀𝐑𝐍𝐈𝐕𝐀𝐋 2025! 🔥 \r\n 𝐓𝐡𝐢𝐬 𝐅𝐞𝐛𝐫𝐮𝐚𝐫𝐲 24–26, 2025, 𝐚𝐭 𝐆𝐨𝐫𝐝𝐨𝐧 𝐂𝐨𝐥𝐥𝐞𝐠𝐞 𝐎𝐯𝐚𝐥 𝐓𝐫𝐚𝐜𝐤, in celebration of the 𝐆𝐨𝐫𝐝𝐨𝐧 𝐂𝐨𝐥𝐥𝐞𝐠𝐞 26𝐭𝐡 𝐅𝐨𝐮𝐧𝐝𝐢𝐧𝐠 𝐀𝐧𝐧𝐢𝐯𝐞𝐫𝐬𝐚𝐫𝐲, 𝐠𝐞𝐭 𝐫𝐞𝐚𝐝𝐲 𝐟𝐨𝐫 𝐚𝐧 𝐮𝐧𝐟𝐨𝐫𝐠𝐞𝐭𝐭𝐚𝐛𝐥𝐞 𝐞𝐱𝐩𝐞𝐫𝐢𝐞𝐧𝐜𝐞! \r\nWhether you love science, enjoy exciting games, or just want to have a blast with friends,𝐈𝐎𝐍𝐒 𝐂𝐀𝐑𝐍𝐈𝐕𝐀𝐋 has something for you!\r\n  𝐀𝐜𝐭𝐢𝐯𝐢𝐭𝐲 𝐋𝐢𝐧𝐞𝐮𝐩!!!!\r\n🎯 𝐌𝐞𝐦𝐨𝐫𝐲 𝐌𝐚𝐭𝐜𝐡 𝐂𝐡𝐚𝐥𝐥𝐞𝐧𝐠𝐞 – Put your memory to the test as you match ions with their correct pairs before time runs out!\r\n 🎟 𝐈𝐨𝐧𝐢𝐜 𝐃𝐫𝐚𝐰 – Try your luck! Pick a number and see if it matches the winning draw for a chance to take home exclusive IONS prizes!\r\n🎡 𝐈𝐎𝐍𝐒  𝐐𝐮𝐚𝐧𝐭𝐮𝐦 𝐆𝐫𝐢𝐝 –  A fun twist on a classic game! Mark off the called-out numbers on your grid card, and when you complete a pattern, shout “Ionic!” to win!\r\n  ✨ 𝐀 𝐅𝐮𝐧-𝐅𝐢𝐥𝐥𝐞𝐝 𝐒𝐜𝐢𝐞𝐧𝐜𝐞 𝐀𝐝𝐯𝐞𝐧𝐭𝐮𝐫𝐞 𝐀𝐰𝐚𝐢𝐭𝐬! ✨ \r\nWith exciting games, friendly competition, and amazing prizes, IONS CARNIVAL guarantees an experience you won’t forget! Gather your friends, show off your skills, and make unforgettable memories!\r\n𝐃𝐨𝐧’𝐭 𝐦𝐢𝐬𝐬 𝐨𝐮𝐭—𝐬𝐭𝐞𝐩 𝐫𝐢𝐠𝐡𝐭 𝐮𝐩 𝐚𝐧𝐝 𝐣𝐨𝐢𝐧 𝐭𝐡𝐞 𝐟𝐮𝐧! 🎉\r\n𝐒𝐞𝐞 𝐲𝐨𝐮 𝐚𝐭 𝐈𝐎𝐍𝐒 𝐂𝐚𝐫𝐧𝐢𝐯𝐚𝐥! \r\n#MaythePowerofScienceCompelsyou\r\n#ionscommunity', 'Function Hall', '2025-05-26', '09:00:00', '2025-05-27', '17:00:00', 'uploads\\1748062322213.webp', '2025-05-24 04:52:02', 4, NULL, 'not yet started'),
(51, 'ELITES Love Dev', '💻❤️ Ignite the Code of Love! ❤️💻\r\nCalling all CCS students! The wait is over— registration for 𝐋𝐨𝐯𝐞𝐃𝐞𝐯: 𝐂𝐫𝐚𝐟𝐭𝐢𝐧𝐠 𝐂𝐨𝐝𝐞 𝐰𝐢𝐭𝐡 𝐇𝐞𝐚𝐫𝐭 starts TODAY! 🗓️ Celebrate Valentine’s Day like never before by turning your coding skills into heartfelt creations. From romantic programs to fun games, let your code connect hearts!\r\n📅 𝗥𝗲𝗴𝗶𝘀𝘁𝗿𝗮𝘁𝗶𝗼𝗻 𝗣𝗲𝗿𝗶𝗼𝗱: February 3-5, 2025\r\n💌 𝗧𝗵𝗲𝗺𝗲:: Building Connections Through Code\r\n🎁 𝗣𝗿𝗶𝘇𝗲𝘀, 𝗰𝗲𝗿𝘁𝗶𝗳𝗶𝗰𝗮𝘁𝗲𝘀, 𝗮𝗻𝗱 𝗯𝗿𝗮𝗴𝗴𝗶𝗻𝗴 𝗿𝗶𝗴𝗵𝘁𝘀 𝗮𝘄𝗮𝗶𝘁 𝗬𝗢𝗨!\r\n💖 Don’t miss the chance to code your way into someone’s heart and showcase your passion, creativity, and skill.\r\n✨ 𝗥𝗘𝗚𝗜𝗦𝗧𝗘𝗥 𝗡𝗢𝗪 ✨\r\n💗 https://docs.google.com/.../1FAIpQLSff.../viewform\r\n💗 https://docs.google.com/.../1FAIpQLSff.../viewform\r\n💗 https://docs.google.com/.../1FAIpQLSff.../viewform\r\n👉 For more details, visit our page or email us at gcccs.elites@gordoncollege.edu.ph.\r\nLet’s craft connections one line of code at a time! 🖥️💞\r\n#ELITESLoveDev \r\n#CodeWithHeart \r\n#ValentinesDay', 'Social Media', '2025-05-26', '08:00:00', '2025-05-28', '18:00:00', 'uploads\\1748062411608.webp', '2025-05-24 04:53:31', 2, NULL, 'not yet started');

-- --------------------------------------------------------

--
-- Table structure for table `event_registrations`
--

CREATE TABLE `event_registrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `event_id` int(11) NOT NULL,
  `student_id` varchar(20) DEFAULT NULL,
  `proof_of_payment` text DEFAULT NULL,
  `qr_code` text DEFAULT NULL,
  `registered_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_registrations`
--

INSERT INTO `event_registrations` (`id`, `event_id`, `student_id`, `proof_of_payment`, `qr_code`, `registered_at`) VALUES
(29, 46, '202211223', '', 'registration_29.png', '2025-05-24 11:17:04'),
(30, 51, '202211223', '', 'registration_30.png', '2025-05-24 13:20:27'),
(31, 48, '202211223', '', 'registration_31.png', '2025-05-24 13:20:34'),
(32, 47, '202211223', '', 'registration_32.png', '2025-05-24 13:20:42');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `message` varchar(255) NOT NULL,
  `event_id` int(11) DEFAULT NULL,
  `org_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `message`, `event_id`, `org_id`, `is_read`, `created_at`) VALUES
(4, NULL, 'GCCBA JPIA created a new event!', 28, NULL, 1, '2025-05-21 19:02:17'),
(5, NULL, 'GCCCS ELITES created a new event!', 29, NULL, 1, '2025-05-21 19:17:13'),
(6, NULL, 'An organization created a new event!', 30, NULL, 0, '2025-05-23 15:51:44'),
(7, NULL, 'An organization created a new event!', 31, NULL, 0, '2025-05-23 16:08:39');

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
-- Table structure for table `registration_details`
--

CREATE TABLE `registration_details` (
  `id` int(10) UNSIGNED NOT NULL,
  `registration_id` int(10) UNSIGNED NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `suffix` varchar(20) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `program` varchar(100) DEFAULT NULL,
  `domain_email` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `registration_details`
--

INSERT INTO `registration_details` (`id`, `registration_id`, `first_name`, `last_name`, `suffix`, `department`, `program`, `domain_email`) VALUES
(24, 29, 'BRIAN GABRIEL', 'GONZALES', '', 'CCS', 'BSIT', '202211223@gordoncollege.edu.ph'),
(25, 30, 'BRIAN GABRIEL', 'GONZALES', '', 'CCS', 'BSIT', '202211223@gordoncollege.edu.ph'),
(26, 31, 'BRIAN GABRIEL', 'GONZALES', '', 'CCS', 'BSIT', '202211223@gordoncollege.edu.ph'),
(27, 32, 'BRIAN GABRIEL', 'GONZALES', '', 'CCS', 'BSIT', '202211223@gordoncollege.edu.ph');

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
('202210888', '202210888@gordoncollege.edu.ph', '$2b$10$LyCbX4ywkOccZba2M7lvf.lGqrQolQhFraivFGj8mYHhB2p/cIR.W', 'Angelo Syrean', 'Bonifacio', 'B', NULL, 'CAHS', 'BSN', '2025-05-21 04:27:07'),
('202211223', '202211223@gordoncollege.edu.ph', '$2b$10$kv0IwFjV24RFDFBOI0GG0u17.RCI8gyKQNnzFzvq.47CSVq7sbzlK', 'Brian Gabriel', 'Gonzales', 'E', NULL, 'CCS', 'BSIT', '2025-05-21 04:18:16');

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
(1, 'org1@email.com', '', NULL, '$2b$10$tQqAPXavmFcl12BvtQ9JledaMOQ1B7NuNkY3qThebonSOI8y4Y62G', '2025-05-18 08:34:02'),
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
  ADD KEY `attendance_records_ibfk_2` (`student_id`);

--
-- Indexes for table `certificates`
--
ALTER TABLE `certificates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`),
  ADD KEY `certificates_ibfk_1` (`student_id`);

--
-- Indexes for table `created_events`
--
ALTER TABLE `created_events`
  ADD PRIMARY KEY (`event_id`),
  ADD KEY `created_by_org_id` (`created_by_org_id`),
  ADD KEY `created_by_osws_id` (`created_by_osws_id`);

--
-- Indexes for table `event_registrations`
--
ALTER TABLE `event_registrations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `event_id` (`event_id`),
  ADD KEY `event_registrations_ibfk_2` (`student_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `osws_admins`
--
ALTER TABLE `osws_admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `registration_details`
--
ALTER TABLE `registration_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `registration_id` (`registration_id`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `certificates`
--
ALTER TABLE `certificates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `created_events`
--
ALTER TABLE `created_events`
  MODIFY `event_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=52;

--
-- AUTO_INCREMENT for table `event_registrations`
--
ALTER TABLE `event_registrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `osws_admins`
--
ALTER TABLE `osws_admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `registration_details`
--
ALTER TABLE `registration_details`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

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

--
-- Constraints for table `registration_details`
--
ALTER TABLE `registration_details`
  ADD CONSTRAINT `registration_details_ibfk_1` FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
