# Assignment: Full-Stack Task Management Application

> **Status: ✅ Complete** — implemented in `apps/api`, `apps/web` and `packages/shared`. See `README.md` for setup, architecture and API documentation.

## Technology Stack
* [x] **Frontend:** Next.js / React.js
* [x] **Backend:** Node.js / Express.js
* [x] **Database:** PostgreSQL
* [x] **ORM:** Prisma
* [x] **Language:** TypeScript / JavaScript

---

## 1. Functional Requirements
Develop a modern, responsive Task Management Application with the following functionality:

### 1.1 Dashboard
* [x] Display total tasks.
* [x] Display completed, pending, and in-progress tasks.
* [x] Display overdue tasks.
* [x] Provide an overview of task statuses and priorities.

### 1.2 Task Management (CRUD)
* [x] Create new tasks.
* [x] View task details.
* [x] Update existing tasks.
* [x] Delete tasks.
* [x] Update task statuses.

### 1.3 Task Listing
* [x] Display tasks in a structured table or appropriate layout.
* [x] Search tasks by title.
* [x] Filter tasks by status and priority.
* [x] Sort tasks by creation date and due date.
* [x] Implement pagination.

### 1.4 Task Details
Each task should contain the following information:
* [x] **Title**
* [x] **Description**
* [x] **Status** (`TODO`, `IN_PROGRESS`, `COMPLETED`)
* [x] **Priority** (`LOW`, `MEDIUM`, `HIGH`)
* [x] **Due Date**
* [x] **Created At**
* [x] **Updated At**

### 1.5 Form Management
* [x] Implement proper form handling.
* [x] Validate user inputs.
* [x] Display meaningful validation messages.
* [x] Handle server-side validation errors.
* [x] Prevent duplicate form submissions.

---

## 2. Backend Technical & Architectural Requirements
The backend must follow standard software engineering principles, including **OOP**, **modular development**, **clean code**, **SOLID principles**, and **separation of concerns**.

### Module Structure
The backend should have clearly separated modules for:
* [x] **Routes:** Define API endpoints and route configurations.
* [x] **Controllers:** Handle HTTP requests and responses.
* [x] **Services:** Contain all business logic.
* [x] **Repositories:** Handle database operations exclusively.
* [x] **DTOs:** Define data transfer objects for requests and responses.
* [x] **Mappers:** Handle transformations between database entities, DTOs, and response objects.
* [x] **Schemas:** Define request and response data structures where appropriate.
* [x] **Validations:** Handle request validation and input constraints.

### Additional Backend Expectations
* [x] Proper REST API design and HTTP status codes.
* [x] Centralized error handling and consistent API responses.
* [x] Input validation and data sanitization.
* [x] Proper database schema design and relationships using Prisma.
* [x] Appropriate database constraints and indexes.
* [x] Environment-based configuration management.
* [x] Proper handling of asynchronous operations.
* [x] Secure and maintainable code practices.
* [x] Separation of business logic from database operations:
  * [x] **Controllers** handle HTTP requests and responses.
  * [x] **Services** contain business logic.
  * [x] **Repositories** exclusively handle database interactions.

---

## 3. Frontend Technical & Architectural Requirements
The frontend should demonstrate good UI/UX practices, reusable component design, maintainable architecture, and proper integration with the backend.

### 3.1 Component-Based Architecture
* [x] Properly structured and reusable components.
* [x] Separation of pages, layouts, components, hooks, services, and utilities.
* [x] Avoid unnecessary code duplication.
* [x] Maintain clear component responsibilities.

### 3.2 UI/UX Design
* [x] Develop a clean, modern, and professional user interface.
* [x] Responsive design supporting desktop, tablet, and mobile devices.
* [x] Consistent typography, spacing, colors, and component styling.
* [x] Proper handling of loading states, empty states, and error states.
* [x] User-friendly navigation and interactions.
* [x] Follow accessibility and semantic HTML best practices.

### 3.3 API Integration
* [x] Maintain a separate API service layer.
* [x] Properly handle API requests and responses.
* [x] Centralized API configuration and error handling.
* [x] Handle network errors and unexpected server responses.
* [x] Avoid placing API request logic directly inside reusable UI components.

### 3.4 State Management
* [x] Appropriate state management for application-wide and component-level states.
* [x] Proper handling of server state and client state.
* [x] Avoid unnecessary API requests and redundant state.

### 3.5 Frontend Best Practices
* [x] Use TypeScript.
* [x] Follow appropriate Next.js / React.js conventions.
* [x] Proper handling of environment variables.
* [x] Avoid unnecessary client-side rendering.
* [x] Maintain consistent coding standards and reusable architecture.

---

## 4. Additional Considerations
The following features are optional but will be considered advantages:
* [x] Kanban board view.
* [x] Drag-and-drop task management.
* [x] Dark and light themes.
* [x] Optimistic UI updates.
* [x] Unit and integration testing.
* [x] Additional security and performance optimizations.
