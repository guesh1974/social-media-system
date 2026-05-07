# 🚀 Social Media Microservices System

A scalable, production-style **event-driven social media backend system** built using **Node.js microservices architecture**.

This project demonstrates how large-scale backend systems are designed using API Gateway, microservices, message brokers, caching, and containerization.

---

## 🧠 Architecture Overview

The system is built using microservices communicating via REST APIs and RabbitMQ events.

### Core Services:

- **API Gateway** – Entry point for all client requests
- **Identity Service** – Authentication & JWT handling
- **Post Service** – Handles post creation and management
- **Media Service** – Handles file uploads and media processing
- **Search Service** – Full-text search with MongoDB indexing

---

## ⚙️ Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- Redis (Caching + Rate limiting)
- RabbitMQ (Event-driven communication)
- Docker + Docker Compose
- JWT Authentication
- Winston Logger

---

## 🔄 Event-Driven Flow

Example flow when a post is created:

1. User creates a post (Post Service)
2. Event is published → `post.created`
3. Search Service consumes event
4. Search index is updated automatically

---

## 🐳 Run with Docker

```bash
docker-compose up --build
