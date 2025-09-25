# Smart City Management Platform 

**Capstone Project — IIT Guwahati Micro Degree Program (Computer Science)**

> This project was developed as part of my final capstone submission for the IIT Guwahati Micro Degree Program.  
> It demonstrates a full-stack implementation of a **Smart City Management Platform** with real-time dashboards, alerts, notifications, and role-based access.

---
**Links**

**Frontend Dashboard Link:** https://smart-city-management-platform.onrender.com/

**Backend Link:** https://smartcity-kwvz.onrender.com/

--- 

**Login Credentials**

**1. Admin**
- Username: admin@example.com
- Password: secret123

**2. Operator**
- Username: ops@example.com
- Password: operator123

**3.Viewer**
- Username: viewer@example.com
- Password: viewer123

---

## Project Overview

The **Smart City Management Platform** is a centralized solution to monitor, analyze, and optimize city infrastructure and services such as **traffic, air quality, waste management, and utilities**.  

It integrates real-time metrics, visual dashboards, and alerting mechanisms to support data-driven decisions for city administrators.

### Key Features Implemented
- **Frontend (React.js)**
  - Real-time dashboard with charts, heatmaps, and trendlines
  - Alerts page to submit and view manual alerts
  - Auto Alerts page for threshold-based anomaly detection and acknowledgements
  - Role-based UI (Admin, Operator, Viewer)

- **Backend (Node.js + Express)**
  - REST API endpoints for authentication, metrics, thresholds, and alerts
  - JWT-based authentication and role-based authorization
  - Database integration with PostgreSQL
  - Notifications via **Email (Resend)** and **Web Push API**

- **Database (PostgreSQL)**
  - Tables: `users`, `alerts`, `breaches`, `metrics`, `thresholds`
  - Seed data for sample metrics and roles (Admin, Operator, Viewer)

- **Security**
  - Password hashing with bcrypt
  - Helmet + rate limiting for API hardening
  - CORS configuration

- **Deployment Ready**
  - Dockerized backend + frontend
  - Works locally and on Render (Static Site + Web Service + Postgres)

---

## Architecture

![Architecture Diagram](docs/Images/Architecture_Diagram_Smartcity.png)



---

**Project Output**

![Project Output](docs/Images/Dashboardpage.png)



---

## Tech Stack
- **Frontend:** React.js, Chart.js, Axios  
- **Backend:** Node.js, Express.js, JWT, Bcrypt, Resend, Web Push API  
- **Database:** PostgreSQL  
- **Security:** Helmet, express-rate-limit, CORS  
- **Testing:** Jest, Supertest  
- **Deployment:** Docker, Render  


