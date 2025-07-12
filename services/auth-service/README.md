# Auth Service

## Descrição

Serviço de autenticação e autorização da plataforma de processamento de vídeos. Implementa arquitetura hexagonal com NestJS e TypeScript.

## Funcionalidades

- Registro e autenticação de usuários
- Geração e validação de tokens JWT
- Middleware de autorização
- Cache de sessões com Redis
- Hash seguro de senhas com bcrypt
- Validação de dados de entrada
- Métricas para Prometheus

## Arquitetura Hexagonal

### Domain (Domínio)

- **Entities**: `User`
- **Value Objects**: `Email`, `Password`
- **Repositories**: `UserRepository` (interface)
- **Services**: `AuthDomainService`

### Application (Aplicação)

- **Use Cases**: `LoginUseCase`, `RegisterUseCase`, `RefreshTokenUseCase`
- **DTOs**: `LoginDto`, `RegisterDto`, `UserResponseDto`
- **Ports**: Interfaces para repositórios e serviços externos

### Infrastructure (Infraestrutura)

- **Database**: TypeORM com PostgreSQL
- **Cache**: Redis
- **Password**: bcrypt
- **JWT**: @nestjs/jwt

### Presentation (Apresentação)

- **Controllers**: `AuthController`
- **Guards**: `JwtAuthGuard`, `LocalAuthGuard`
- **Strategies**: `JwtStrategy`, `LocalStrategy`

## Endpoints

### POST /auth/register

Registra um novo usuário.

**Body:**

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "User registered successfully",
  "success": true,
  "statusCode": 201
}
```

### POST /auth/login

Autentica um usuário.

**Body:**

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123"
}
```

**Response:**

```json
{
  "data": {
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe"
    }
  },
  "message": "Login successful",
  "success": true,
  "statusCode": 200
}
```

### POST /auth/refresh

Renova o token de acesso.

**Body:**

```json
{
  "refreshToken": "refresh_token_here"
}
```

### GET /auth/profile

Obtém o perfil do usuário autenticado.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

### GET /auth/validate

Valida um token JWT.

**Headers:**

```
Authorization: Bearer jwt_token_here
```

## Variáveis de Ambiente

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/video_platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

## Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar migrações
npm run migration:run

# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod

# Testes
npm run test
npm run test:e2e
npm run test:cov
```

## Swagger

Documentação da API disponível em: `http://localhost:3000/api/docs`

## Métricas

Métricas do Prometheus disponíveis em: `http://localhost:3000/metrics`

## Estrutura de Arquivos

```
src/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/
│   └── services/
├── application/
│   ├── use-cases/
│   ├── dtos/
│   └── ports/
├── infrastructure/
│   ├── database/
│   ├── cache/
│   ├── security/
│   └── config/
└── presentation/
    ├── controllers/
    ├── guards/
    ├── strategies/
    └── middlewares/
```
