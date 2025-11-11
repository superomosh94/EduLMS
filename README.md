README.md
markdown
# EduLMS - Learning Management System

A comprehensive Learning Management System with M-Pesa payment integration, designed for educational institutions.

## Features

- **Multi-role System**: Admin, Instructor, Student, Finance Officer
- **Course Management**: Create, manage, and enroll in courses
- **Assignment System**: Assignments with file submissions and grading
- **M-Pesa Integration**: Secure payment processing via STK Push
- **PDF Report Generation**: Academic and financial reports
- **Real-time Notifications**: System-wide notifications
- **Audit Logging**: Comprehensive activity tracking

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Template Engine**: EJS
- **Authentication**: Passport.js
- **Payments**: M-Pesa STK Push
- **PDF Generation**: PDFKit

## Installation

1. Clone the repository:
``bash
git clone https://github.com/your-username/edulms.git
cd edulms
Install dependencies:

bash
npm install
Set up environment variables:

bash
cp .env.example .env
# Edit .env with your configuration
Set up the database:

bash
# Import the database schema
mysql -u root -p < config/database-schema.sql
Run the application:

bash
# Development
npm run dev

# Production
npm start
Default Accounts
Admin: admin@edulms.com / password123

Instructor: instructor@edulms.com / password123

Student: student@edulms.com / password123

Finance: finance@edulms.com / password123

API Documentation
See docs/api/ for detailed API documentation.

License
MIT License