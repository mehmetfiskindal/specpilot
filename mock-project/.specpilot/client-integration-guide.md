# Mock API - Client Integration Guide

> **API Version**: `1.0.0`
> **Generated on**: 5/20/2026

Client integration guide and endpoints contract reference.

## 🔒 Authentication

### BearerAuth
- **Type**: `http`
- **Scheme**: `bearer`

Example Authentication Header:
```http
Authorization: Bearer <your-token-here>
```

## 📦 Data Models (TypeScript Types)

Copy-paste these interface definitions directly into your frontend or mobile API models file:

```typescript
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  name?: string;
  role: 'admin' | 'user';
}

export interface Item {
  id: number;
  name: string;
  tags?: string[];
}

export interface CreateItemRequest {
  name: string;
  tags?: string[];
}

```

## 🔌 Endpoint Reference

### User Login
`POST` `/auth/login`

- **Authentication**: 🌐 Public (No authentication)

#### Request Body

- **Content-Type**: `application/json`
- **Schema Model**: `LoginRequest`

Request Example:
```json
{
  "email": "user@example.com",
  "password": "string"
}
```


#### Responses

| Status Code | Description | Model Schema |
|---|---|---|
| `200` | Success | `User` |
| `400` | Bad Request | - |

Response Example (`200`):
```json
{
  "id": 123,
  "email": "user@example.com",
  "name": "string",
  "role": "admin"
}
```

***

### Refresh Token
`POST` `/auth/refresh`

- **Authentication**: 🔑 Required

#### Responses

| Status Code | Description | Model Schema |
|---|---|---|
| `200` | Success | - |
| `401` | Unauthorized | - |

***

### Get current user profile
`GET` `/users/me`

- **Authentication**: 🔑 Required

#### Responses

| Status Code | Description | Model Schema |
|---|---|---|
| `200` | Success | `User` |
| `401` | Unauthorized | - |

Response Example (`200`):
```json
{
  "id": 123,
  "email": "user@example.com",
  "name": "string",
  "role": "admin"
}
```

***

### Get items list
`GET` `/items`

- **Authentication**: 🌐 Public (No authentication)

#### Responses

| Status Code | Description | Model Schema |
|---|---|---|
| `200` | Success | `Item[]` |

Response Example (`200`):
```json
[
  {
    "id": 123,
    "name": "string",
    "tags": [
      "string"
    ]
  }
]
```

***

### Create an item
`POST` `/items`

- **Authentication**: 🔑 Required

#### Request Body

- **Content-Type**: `application/json`
- **Schema Model**: `CreateItemRequest`

Request Example:
```json
{
  "name": "string",
  "tags": [
    "string"
  ]
}
```


#### Responses

| Status Code | Description | Model Schema |
|---|---|---|
| `201` | Created | `Item` |
| `400` | Bad Request | - |
| `401` | Unauthorized | - |

Response Example (`201`):
```json
{
  "id": 123,
  "name": "string",
  "tags": [
    "string"
  ]
}
```

***

