# Video Processing Service

## Descrição

Serviço responsável pelo processamento de vídeos, extração de frames e geração de arquivos ZIP. Implementa arquitetura hexagonal com NestJS e TypeScript.

## Funcionalidades

- Upload de vídeos com validação
- Processamento assíncrono de vídeos
- Extração de frames usando FFmpeg
- Geração de arquivos ZIP com os frames
- Controle de fila de processamento
- Monitoramento de status de processamento
- Métricas detalhadas de performance
- Notificações de conclusão/erro

## Arquitetura Hexagonal

### Domain (Domínio)

- **Entities**: `Video`, `VideoProcessingJob`
- **Value Objects**: `VideoMetadata`, `ProcessingResult`
- **Repositories**: `VideoRepository`, `ProcessingJobRepository`
- **Services**: `VideoProcessingDomainService`

### Application (Aplicação)

- **Use Cases**: `UploadVideoUseCase`, `ProcessVideoUseCase`, `GetVideoStatusUseCase`
- **DTOs**: `UploadVideoDto`, `VideoResponseDto`, `ProcessingJobDto`
- **Ports**: Interfaces para serviços externos

### Infrastructure (Infraestrutura)

- **Database**: TypeORM com PostgreSQL
- **Queue**: Bull Queue com Redis
- **Storage**: File System + AWS S3
- **Video Processing**: FFmpeg
- **Compression**: Archiver

### Presentation (Apresentação)

- **Controllers**: `VideoController`, `ProcessingController`
- **Middlewares**: `FileUploadMiddleware`, `AuthMiddleware`
- **Guards**: `JwtAuthGuard`

## Endpoints

### POST /videos/upload

Upload de um novo vídeo para processamento.

**Content-Type:** `multipart/form-data`

**Body:**

```
file: [video file]
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "filename": "video.mp4",
    "originalName": "My Video.mp4",
    "size": 1024000,
    "status": "pending",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Video uploaded successfully",
  "success": true,
  "statusCode": 201
}
```

### GET /videos

Lista todos os vídeos do usuário.

**Query Parameters:**

- `status`: Filtrar por status (pending, processing, completed, failed)
- `page`: Página (default: 1)
- `limit`: Itens por página (default: 10)

**Response:**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "filename": "video.mp4",
        "originalName": "My Video.mp4",
        "status": "completed",
        "downloadUrl": "https://example.com/download/frames.zip",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "processedAt": "2024-01-01T00:05:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "message": "Videos retrieved successfully",
  "success": true
}
```

### GET /videos/:id

Obtém detalhes de um vídeo específico.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "filename": "video.mp4",
    "originalName": "My Video.mp4",
    "size": 1024000,
    "duration": 120,
    "status": "completed",
    "downloadUrl": "https://example.com/download/frames.zip",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "processedAt": "2024-01-01T00:05:00.000Z"
  },
  "message": "Video retrieved successfully",
  "success": true
}
```

### GET /videos/:id/download

Download do arquivo ZIP com os frames extraídos.

**Response:** Arquivo ZIP

### POST /videos/:id/reprocess

Reprocessa um vídeo que falhou.

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "status": "queued"
  },
  "message": "Video queued for reprocessing",
  "success": true
}
```

### GET /processing/status

Obtém estatísticas da fila de processamento.

**Response:**

```json
{
  "data": {
    "pending": 5,
    "processing": 2,
    "completed": 100,
    "failed": 3,
    "delayed": 1
  },
  "message": "Processing statistics retrieved",
  "success": true
}
```

## Configuração

### Variáveis de Ambiente

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/video_platform
REDIS_URL=redis://localhost:6379

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=100MB
ALLOWED_EXTENSIONS=mp4,avi,mov,mkv,wmv

# Video Processing
FRAMES_PER_SECOND=1
OUTPUT_FORMAT=png
COMPRESSION_QUALITY=95
MAX_CONCURRENT_JOBS=3

# Storage
STORAGE_PATH=./storage
TEMP_PATH=./temp
AWS_S3_BUCKET=video-platform-storage
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# SQS
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/video-processing
SQS_ENDPOINT=http://localhost:4566
```

### Instalação do FFmpeg

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
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

## Processamento de Vídeos

### Fluxo de Processamento

1. **Upload**: Vídeo é carregado e validado
2. **Enfileiramento**: Job é adicionado à fila do Redis
3. **Processamento**: Worker extrai frames usando FFmpeg
4. **Compressão**: Frames são compactados em ZIP
5. **Armazenamento**: ZIP é salvo e URL é gerada
6. **Notificação**: Usuário é notificado da conclusão

### Tipos de Processamento

- **Extração de Frames**: 1 frame por segundo (configurável)
- **Redimensionamento**: Frames redimensionados para otimizar tamanho
- **Compressão**: ZIP com compressão otimizada
- **Metadados**: Informações sobre duração, resolução, etc.

### Monitoramento

- **Métricas**: Tempo de processamento, taxa de sucesso, recursos utilizados
- **Logs**: Detalhamento completo do processamento
- **Health Checks**: Verificação de componentes críticos
- **Alertas**: Notificações em caso de falhas

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
│   ├── queue/
│   ├── storage/
│   ├── processing/
│   └── config/
└── presentation/
    ├── controllers/
    ├── middlewares/
    └── guards/
```
