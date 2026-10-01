-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 11, 2026 at 12:08 AM
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
-- Database: `coding-mastery`
--

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

CREATE TABLE `courses` (
  `id` int(11) NOT NULL,
  `slug` varchar(160) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `category` varchar(100) NOT NULL,
  `difficulty` enum('Basic','Intermediate','Advanced') NOT NULL DEFAULT 'Basic',
  `duration` varchar(100) DEFAULT NULL,
  `language` varchar(50) NOT NULL DEFAULT 'English',
  `certificate` tinyint(1) NOT NULL DEFAULT 1,
  `image_url` varchar(500) DEFAULT NULL,
  `image_gradient` varchar(255) NOT NULL DEFAULT 'from-slate-700 via-slate-800 to-slate-900',
  `youtube_url` varchar(500) DEFAULT NULL,
  `instructor_name` varchar(255) NOT NULL,
  `instructor_title` varchar(255) DEFAULT NULL,
  `instructor_bio` text DEFAULT NULL,
  `instructor_experience_years` int(11) DEFAULT NULL,
  `instructor_expertise` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`instructor_expertise`)),
  `instructor_users_taught` varchar(50) DEFAULT NULL,
  `levels_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`levels_json`)),
  `teacher_id` int(11) NOT NULL,
  `status` enum('draft','pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejection_reason` text DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 0,
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `discount_percent` decimal(5,2) DEFAULT NULL,
  `commission_percent` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `courses`
--

INSERT INTO `courses` (`id`, `slug`, `title`, `description`, `category`, `difficulty`, `duration`, `language`, `certificate`, `image_url`, `image_gradient`, `youtube_url`, `instructor_name`, `instructor_title`, `instructor_bio`, `instructor_experience_years`, `instructor_expertise`, `instructor_users_taught`, `levels_json`, `teacher_id`, `status`, `rejection_reason`, `approved_by`, `approved_at`, `submitted_at`, `is_published`, `is_featured`, `discount_percent`, `commission_percent`, `created_at`, `updated_at`) VALUES
(5, 'microfrontend-react-jg35zp', 'Microfrontend React', 'Micro frontend is used in React js . it can help to developed  frontend application , and you can develop fast', 'Frontend', 'Basic', '5', 'English', 1, 'http://localhost:5000/uploads/courses/course-1782992383417-fdcbbd0ab759.jpg', 'from-slate-700 via-slate-800 to-slate-900', 'https://www.youtube.com/@codingmasterybyamit', 'Roma', 'Senior Frontend developer', 'I have 12 year experience frontend development in micro frontend', 4, '[\"Nodejs\",\"React js\",\"Mongo DB\"]', '45', '{\"Basic\":{\"price\":8011,\"longDescription\":\"Overview / long description his is the long description  1 for basic label\",\"learningOutcomes\":[\"Learning outcomes 1\"],\"prerequisites\":[\"html\",\"clls\",\"nextjs\",\"react\",\"xaaa\",\"java script\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab) for basic\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab) for basic\"}],\"interviewQuestions\":[{\"question\":\"Interview question edit1\",\"answer\":\"Interview question edit1 answer\"}]},\"Intermediate\":{\"price\":7221,\"longDescription\":\"Overview / long description\",\"learningOutcomes\":[\"Learning outcomes 1\",\"Learning outcomes 2\"],\"prerequisites\":[\"Prerequisites1\",\"Prerequisites2\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module1\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab) question1\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab) ans 1\"}],\"interviewQuestions\":[{\"question\":\"Interview question 1\",\"answer\":\"Interview question1\"}]},\"Advanced\":{\"price\":90000,\"longDescription\":\"Overview / long description1\",\"learningOutcomes\":[\"Learning outcomes\"],\"prerequisites\":[\"Prerequisites\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module1\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab)\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab)\"}],\"interviewQuestions\":[{\"question\":\"Interview question\",\"answer\":\"Interview question answer\"}]}}', 11, 'approved', NULL, 12, '2026-07-01 16:00:27', '2026-07-01 15:24:15', 1, 0, NULL, NULL, '2026-07-01 15:24:15', '2026-07-02 12:31:54');

-- --------------------------------------------------------

--
-- Table structure for table `course_levels`
--

CREATE TABLE `course_levels` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `level` enum('Basic','Intermediate','Advanced') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `course_revisions`
--

CREATE TABLE `course_revisions` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `data_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data_json`)),
  `admin_note` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `course_revisions`
--

INSERT INTO `course_revisions` (`id`, `course_id`, `teacher_id`, `status`, `data_json`, `admin_note`, `reviewed_by`, `reviewed_at`, `created_at`, `updated_at`) VALUES
(10, 5, 11, 'approved', '{\"title\":\"Microfrontend React\",\"description\":\"Micro frontend is used in React js . it can help to developed  frontend application\",\"category\":\"Frontend\",\"difficulty\":\"Basic\",\"duration\":\"5\",\"language\":\"English\",\"certificate\":true,\"imageUrl\":\"http://localhost:5000/uploads/courses/course-1782992383417-fdcbbd0ab759.jpg\",\"imageGradient\":\"from-slate-700 via-slate-800 to-slate-900\",\"youtubeUrl\":\"https://www.youtube.com/@codingmasterybyamit\",\"instructor\":{\"name\":\"Roma\",\"title\":\"Senior Frontend developer\",\"bio\":\"I have 12 year experience frontend development in micro frontend\",\"experienceYears\":4,\"expertise\":[\"Nodejs\",\"React js\",\"Mongo DB\"],\"usersTaught\":\"45\"},\"levels\":{\"Basic\":{\"price\":8000,\"longDescription\":\"Overview / long description his is the long description  1 for basic label\",\"learningOutcomes\":[\"Learning outcomes 1\"],\"prerequisites\":[\"html\",\"clls\",\"nextjs\",\"react\",\"xaaa\",\"java script\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab) for basic\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab) for basic\"}],\"interviewQuestions\":[{\"question\":\"interview question for basic\",\"answer\":\"interview ans for the basic\"}]},\"Intermediate\":{\"price\":7000,\"longDescription\":\"Overview / long description\",\"learningOutcomes\":[\"Learning outcomes 1\",\"Learning outcomes 2\"],\"prerequisites\":[\"Prerequisites1\",\"Prerequisites2\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module1\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab) question1\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab) ans 1\"}],\"interviewQuestions\":[{\"question\":\"Interview question 1\",\"answer\":\"Interview question1\"}]},\"Advanced\":{\"price\":90000,\"longDescription\":\"Overview / long description1\",\"learningOutcomes\":[\"Learning outcomes\"],\"prerequisites\":[\"Prerequisites\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module1\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab)\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab)\"}],\"interviewQuestions\":[{\"question\":\"Interview question\",\"answer\":\"Interview question answer\"}]}}}', NULL, 12, '2026-07-02 11:54:31', '2026-07-02 11:42:55', '2026-07-02 11:54:31'),
(11, 5, 11, 'approved', '{\"title\":\"Microfrontend React\",\"description\":\"Micro frontend is used in React js . it can help to developed  frontend application , and you can develop fast\",\"category\":\"Frontend\",\"difficulty\":\"Basic\",\"duration\":\"5\",\"language\":\"English\",\"certificate\":true,\"imageUrl\":\"http://localhost:5000/uploads/courses/course-1782992383417-fdcbbd0ab759.jpg\",\"imageGradient\":\"from-slate-700 via-slate-800 to-slate-900\",\"youtubeUrl\":\"https://www.youtube.com/@codingmasterybyamit\",\"instructor\":{\"name\":\"Roma\",\"title\":\"Senior Frontend developer\",\"bio\":\"I have 12 year experience frontend development in micro frontend\",\"experienceYears\":4,\"expertise\":[\"Nodejs\",\"React js\",\"Mongo DB\"],\"usersTaught\":\"45\"},\"levels\":{\"Basic\":{\"price\":8000,\"longDescription\":\"Overview / long description his is the long description  1 for basic label\",\"learningOutcomes\":[\"Learning outcomes 1\"],\"prerequisites\":[\"html\",\"clls\",\"nextjs\",\"react\",\"xaaa\",\"java script\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab) for basic\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab) for basic\"}],\"interviewQuestions\":[{\"question\":\"Interview question edit1\",\"answer\":\"Interview question edit1 answer\"}]},\"Intermediate\":{\"price\":7000,\"longDescription\":\"Overview / long description\",\"learningOutcomes\":[\"Learning outcomes 1\",\"Learning outcomes 2\"],\"prerequisites\":[\"Prerequisites1\",\"Prerequisites2\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module1\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab) question1\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab) ans 1\"}],\"interviewQuestions\":[{\"question\":\"Interview question 1\",\"answer\":\"Interview question1\"}]},\"Advanced\":{\"price\":90000,\"longDescription\":\"Overview / long description1\",\"learningOutcomes\":[\"Learning outcomes\"],\"prerequisites\":[\"Prerequisites\"],\"modules\":[{\"id\":\"\",\"title\":\"Syllabus modules1\",\"topics\":[\"Topics in this module1\"]}],\"topicsCovered\":[{\"question\":\"Topics covered (Q&A shown on Topics Covered tab)\",\"answer\":\"Topics covered (Q&A shown on Topics Covered tab)\"}],\"interviewQuestions\":[{\"question\":\"Interview question\",\"answer\":\"Interview question answer\"}]}}}', NULL, 12, '2026-07-02 12:31:54', '2026-07-02 12:30:09', '2026-07-02 12:31:54');

-- --------------------------------------------------------

--
-- Table structure for table `enrollments`
--

CREATE TABLE `enrollments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_slug` varchar(160) NOT NULL,
  `enrolled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `purchased` tinyint(1) NOT NULL DEFAULT 0,
  `purchased_at` timestamp NULL DEFAULT NULL,
  `purchased_levels` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`purchased_levels`)),
  `progress` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `enrollments`
--

INSERT INTO `enrollments` (`id`, `user_id`, `course_slug`, `enrolled_at`, `purchased`, `purchased_at`, `purchased_levels`, `progress`, `created_at`, `updated_at`) VALUES
(16, 13, 'postgresql', '2026-06-28 17:14:26', 0, NULL, '[]', 18, '2026-06-28 17:14:26', '2026-06-28 17:14:26'),
(17, 10, 'next-js', '2026-06-29 18:01:14', 1, '2026-06-29 18:01:41', '[\"Advanced\"]', 18, '2026-06-29 18:01:14', '2026-06-29 18:01:41'),
(18, 10, 'microfrontend-react-jg35zp', '2026-07-02 12:40:13', 1, '2026-07-02 12:40:19', '[\"Intermediate\",\"Advanced\"]', 11, '2026-07-02 12:40:13', '2026-07-02 12:43:41'),
(19, 10, 'aws', '2026-07-02 12:46:44', 1, '2026-07-02 12:46:46', '[\"Basic\"]', 12, '2026-07-02 12:46:44', '2026-07-02 12:46:46');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `topics`
--

CREATE TABLE `topics` (
  `id` int(11) NOT NULL,
  `course_level_id` int(11) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  `question` varchar(500) NOT NULL,
  `answer` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `topic_edit_requests`
--

CREATE TABLE `topic_edit_requests` (
  `id` int(11) NOT NULL,
  `course_level_id` int(11) NOT NULL,
  `teacher_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected','consumed') NOT NULL DEFAULT 'pending',
  `reason` text DEFAULT NULL,
  `admin_note` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `consumed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `contact` varchar(20) DEFAULT NULL,
  `role` enum('user','teacher','admin') NOT NULL DEFAULT 'user',
  `status` enum('active','pending','rejected','suspended') NOT NULL DEFAULT 'active',
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `contact`, `role`, `status`, `is_deleted`, `deleted_at`, `created_at`, `updated_at`) VALUES
(10, 'Amit', 'amit@gmail.com', '$2a$10$7UugU40jo/XEqyziaXUkf.RvfYg1vAjxRkp8RPx9b9oaIvTvkzs7.', '1234567890', 'user', 'active', 0, NULL, '2026-06-28 15:24:46', '2026-06-28 15:24:46'),
(11, 'Roma', 'roma@gmail.com', '$2a$10$FrWHv0YnzPMGVq1nHuT/X.Eh6ZmEcyfVGWCp9g.W/VLGGRBK1O3v6', '1234567890', 'teacher', 'active', 0, NULL, '2026-06-28 15:29:34', '2026-06-28 15:38:21'),
(12, 'Admin', 'admin@gmail.com', '$2a$10$ibM57M6DvQnw12UhmRfgCe8Dg4silaRvMl/KsSFnkVFdxb/6Y7asC', '1234567890', 'admin', 'active', 0, NULL, '2026-06-28 15:36:45', '2026-06-28 15:36:45'),
(13, 'Ravi kumar', 'ravi@gmail.com', '$2a$10$YvJPBViLJIaOY9HdfRpdZe1mKmesVKEw4saCgX1R6LMLOcmXKuUfa', '1234567890', 'user', 'active', 0, NULL, '2026-06-28 16:50:42', '2026-06-28 16:50:42');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_courses_status` (`status`),
  ADD KEY `idx_courses_teacher` (`teacher_id`),
  ADD KEY `fk_courses_approver` (`approved_by`),
  ADD KEY `idx_courses_published` (`is_published`),
  ADD KEY `idx_courses_featured` (`is_featured`);

--
-- Indexes for table `course_levels`
--
ALTER TABLE `course_levels`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_course_level` (`course_id`,`level`);

--
-- Indexes for table `course_revisions`
--
ALTER TABLE `course_revisions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cr_course` (`course_id`),
  ADD KEY `idx_cr_teacher` (`teacher_id`),
  ADD KEY `idx_cr_status` (`status`),
  ADD KEY `fk_cr_reviewer` (`reviewed_by`);

--
-- Indexes for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_enroll_user_course` (`user_id`,`course_slug`),
  ADD KEY `idx_enroll_user` (`user_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_prt_token` (`token_hash`),
  ADD KEY `idx_prt_user` (`user_id`);

--
-- Indexes for table `topics`
--
ALTER TABLE `topics`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_topics_level` (`course_level_id`);

--
-- Indexes for table `topic_edit_requests`
--
ALTER TABLE `topic_edit_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ter_level` (`course_level_id`),
  ADD KEY `idx_ter_teacher` (`teacher_id`),
  ADD KEY `idx_ter_status` (`status`),
  ADD KEY `fk_ter_reviewer` (`reviewed_by`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_role` (`role`),
  ADD KEY `idx_users_status` (`status`),
  ADD KEY `idx_users_deleted` (`is_deleted`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `course_levels`
--
ALTER TABLE `course_levels`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `course_revisions`
--
ALTER TABLE `course_revisions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `enrollments`
--
ALTER TABLE `enrollments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `topics`
--
ALTER TABLE `topics`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `topic_edit_requests`
--
ALTER TABLE `topic_edit_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `courses`
--
ALTER TABLE `courses`
  ADD CONSTRAINT `fk_courses_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_courses_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `course_levels`
--
ALTER TABLE `course_levels`
  ADD CONSTRAINT `fk_course_levels_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `course_revisions`
--
ALTER TABLE `course_revisions`
  ADD CONSTRAINT `fk_cr_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cr_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_cr_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `enrollments`
--
ALTER TABLE `enrollments`
  ADD CONSTRAINT `fk_enroll_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `topics`
--
ALTER TABLE `topics`
  ADD CONSTRAINT `fk_topics_level` FOREIGN KEY (`course_level_id`) REFERENCES `course_levels` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `topic_edit_requests`
--
ALTER TABLE `topic_edit_requests`
  ADD CONSTRAINT `fk_ter_level` FOREIGN KEY (`course_level_id`) REFERENCES `course_levels` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ter_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ter_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
