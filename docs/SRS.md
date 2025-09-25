# Software Requirements Specification (SRS)  
### Project 4: Smart City Management Platform  

---

## 1. Introduction  

### 1.1 Purpose  
The Smart City Management Platform is a centralized web-based system designed to help city administrators monitor, analyze, and optimize urban infrastructure and public services. It integrates real-time and historical data from multiple city systems (traffic, air quality, waste management, utilities) into a single dashboard, enabling data-driven governance and rapid response through alerts and notifications.  

### 1.2 Scope  
The platform provides:  
- A real-time **dashboard** with charts, heatmaps, and recommendations.  
- **Alert management** (manual alerts + auto breaches triggered by thresholds).  
- **Notification services** through web push, in-app, and email.  
- **Analytics & Recommendations** with insights on traffic, environment, waste, and utilities.  
- **Role-based access control** (Admin, Operator, Viewer).  
- **Deployment-ready containerization** using Docker and cloud hosting (Render).  

### 1.3 Definitions & Acronyms  
- **Admin** – User with full system privileges.  
- **Operator** – User responsible for acknowledging alerts and managing incidents.  
- **Viewer** – User with read-only access to dashboards and alerts.  
- **JWT** – JSON Web Token for authentication.  
- **CORS** – Cross-Origin Resource Sharing.  

---

## 2. Overall Description  

### 2.1 Product Perspective  
The platform acts as a middleware solution between city IoT sensors, a PostgreSQL database, and visualization dashboards. Data is collected and stored, then exposed through APIs to a React.js frontend. The backend runs on Node.js + Express, with notifications delivered through Resend (email) and Web Push APIs.  

### 2.2 Product Functions  
- **Authentication & Authorization:** Secure login with JWT and bcrypt-based password hashing.  
- **Dashboard:** Visualize traffic, air quality, waste, and electricity metrics using charts and heatmaps.  
- **Alerts:**  
  - Manual alerts (user-created).  
  - Automatic breaches (triggered every 15s by background evaluation against thresholds).  
- **Notifications:**  
  - In-app notifications with read/unread status.  
  - Push notifications via browser Web Push API.  
  - Email notifications via Resend API.  
- **Analytics & Recommendations:** Statistical analysis (mean, standard deviation, slope, z-score) with domain-specific recommendations for traffic flow, air quality advisories, waste routing, and electricity load balancing.  

### 2.3 User Characteristics  
- **Admin:** Manages thresholds, sends notifications, views all metrics, updates configurations.  
- **Operator:** Views dashboards, acknowledges breaches, sends notifications, but cannot change thresholds.  
- **Viewer:** Limited to viewing dashboards and alerts.  

### 2.4 Constraints  
- PostgreSQL database must be available with schema defined in `db.js`.  
- JWT secret and notification service keys must be configured in `.env`.  
- Render cloud deployment requires CORS origin to be explicitly set to frontend URL.  
- Email sending requires verified domains in Resend.  

### 2.5 Assumptions & Dependencies  
- IoT/sensor data is simulated in this version using random generators.  
- Internet connectivity is required for email/push notification services.  
- Users will access the system via modern browsers with service worker support for push.  

---

## 3. Specific Requirements  

### 3.1 Functional Requirements  

1. **Authentication & Security**  
   - Users can register/login using email + password.  
   - Passwords stored securely with bcrypt hashing.  
   - JWT tokens issued on login and required for protected APIs.  

2. **Role-Based Access**  
   - Admin: CRUD thresholds, send alerts, view metrics.  
   - Operator: View metrics, acknowledge alerts, send notifications.  
   - Viewer: Read-only access to dashboards and alerts.  

3. **Metrics Monitoring**  
   - `/metrics/summary` endpoint returns simulated live metrics.  
   - Metrics include traffic, air quality, waste, electricity.  
   - Stored in `metrics_timeseries` table for time-series analysis.  

4. **Thresholds & Breaches**  
   - Admin sets thresholds (`warn`, `critical`) per metric.  
   - Background evaluator runs every 15s to insert breaches.  
   - Operators/Admins can acknowledge breaches.  

5. **Alerts**  
   - Manual alerts created by authenticated users.  
   - Auto alerts inserted into `alerts_breaches` table when thresholds are exceeded.  
   - Alerts displayed in dashboard in reverse chronological order.  

6. **Notifications**  
   - In-app: Paginated, unread badge count, mark-as-read support.  
   - Web Push: Subscribe, unsubscribe, send, test.  
   - Email: Send via `/notifications/email/send` or `/notifications/email/test`.  

7. **Analytics & Recommendations**  
   - Statistical analysis of each metric (`mean`, `std dev`, `slope`, `z-score`).  
   - Dynamic recommendations generated in `Recommendations.js`.  
   - Example: High traffic → “Enable green-wave signal timing.”  

---

### 3.2 Non-Functional Requirements  

- **Performance:** API supports at least 100 concurrent users. Evaluator runs every 15s without blocking requests.  
- **Security:** Helmet + rate limiting (300 req per 15 min per IP).  
- **Reliability:** Fail-safe defaults for notifications (skip unsubscribed endpoints).  
- **Scalability:** Database schema supports adding new metrics with minimal changes.  
- **Maintainability:** Modular React components (`Dashboard.js`, `TrafficChart.js`, `MatrixHeatmap.js`, `Recommendations.js`).  
- **Portability:** Dockerized for easy deployment on Render or other cloud providers.  

---

## 4. System Features  

1. **Authentication Module**  
   - API: `/register`, `/login`.  
   - DB: `users` table with roles.  

2. **Dashboard Module**  
   - UI: `Dashboard.js`, `TrafficChart.js`, `MatrixHeatmap.js`.  
   - Shows traffic, air, waste, and electricity metrics.  

3. **Alerts Module**  
   - API: `/alerts` (manual) and `/alerts/breaches`.  
   - UI: `Alerts.js`, `AutoAlerts.js`.  

4. **Notifications Module**  
   - API: `/notifications` routes.  
   - UI: `Notification.js`, `NotificationBell.js`.  
   - Push subscription handled by service worker (`sw.js`).  

5. **Analytics Module**  
   - UI: `Recommendations.js`.  
   - Provides actionable insights.  

---

## 5. External Interface Requirements  

### 5.1 User Interfaces  
- React.js frontend with responsive dashboard and role-based navigation.  
- Charts: Line graphs, heatmaps, bar charts, trend lines.  
- Notifications bell with badge count and dropdown.  

### 5.2 APIs  
- Backend: Node.js + Express, documented in `server.js` and `notifications.routes.js`.  
- RESTful endpoints for auth, metrics, thresholds, alerts, and notifications.  

### 5.3 Database  
PostgreSQL schema (`db.js`):  
- `users`, `thresholds`, `alerts`, `alerts_breaches`, `metrics_timeseries`, `webpush_subscriptions`, `notifications`.  

### 5.4 Hardware/Software Constraints  
- Browser with ES6 and Service Worker support.  
- Docker runtime for containerized deployment.  

---

## 6. System Architecture  

### 6.1 Design  
- **Frontend (React.js):** Dashboard UI, notifications, analytics.  
- **Backend (Node.js + Express):** Authentication, metrics API, alerts, notifications.  
- **Database (PostgreSQL):** Users, metrics, thresholds, alerts, notifications.  
- **Notification Services:** Web Push API + Resend Email.  

### 6.2 Architectural Diagram  
(See `docs/Images/Architecture_Diagram_Smartcity.png` in repo)  

---

## 7. Implementation Plan  

- **Week 1: Planning & Design**  
  - Requirement gathering, database schema, UI wireframes.  
- **Week 2: Core Development**  
  - Backend APIs, frontend dashboard, database connection.  
- **Week 3: Analytics & Optimization**  
  - Add analytics module, charts, trend detection, recommendations.  
- **Week 4: Testing & Deployment**  
  - Add alerts, notifications, security features.  
  - Final Docker deployment on Render.  

---

## 8. Conclusion  

The Smart City Management Platform delivers a functional, secure, and extensible framework for urban monitoring. Its modular design, real-time analytics, and robust notification system make it adaptable for real-world smart city deployments.  

---

