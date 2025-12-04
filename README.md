# Bank Liquidity Dashboard

A full-stack application for visualizing bank liquidity, managing security holdings, and tracking Treasury auctions. Built with **React**, **FastAPI**, **SQLite**, and **Docker**.

## Quick Start

Run this application using Docker Compose.

### 1. Prerequisites
- **Docker Desktop** (Running)
- **Git**

### 2. Installation

**Clone the repository**
   ```bash
   git clone https://github.com/karina-michelle/bank-liquidity-app.git
   cd bank-liquidity-app
   ```

### 3. Launch the App
    docker compose -f 'docker-compose.yaml' up -d --build
### 4. Access the App
Navigate to http://localhost:3000 in your browser
### 5. Troubleshooting
1. Backend container fails with `"./entrypoint.sh : no such file or directory"` ? It's a Windows line endings problem.
   To solve:
   * Change line endings for file `backend/entrypoint.sh` in VS Code from CRLF to LF
   
   OR
   * Prevent Git from automatically converting LF to CRLF, run this in your terminal:
     ```bash
      git config --global core.autocrlf input
      ```
   Then rebuild the container.
