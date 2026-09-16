pipeline {
    agent any
    environment {
        REPO = 'https://github.com/jobu-techie/penzi.git'
        DEPLOY_DIR = '/opt/penzi-deploy'
        // Compose's own ${VAR} interpolation (used by the db service) only
        // auto-discovers a .env next to the compose file; ours lives in
        // backend/ instead, so every docker compose call below passes this
        // explicitly rather than duplicating the file at the repo root.
        COMPOSE_ENV_FILE = 'backend/.env'
    }
    stages {
        stage('Clone Repository') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'github-credentials', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
                    sh '''
                        mkdir -p ${DEPLOY_DIR}
                        if [ -d "${DEPLOY_DIR}/penzi/.git" ]; then
                            echo "Pulling latest..."
                            cd ${DEPLOY_DIR}/penzi && git pull https://${GIT_USER}:${GIT_TOKEN}@github.com/jobu-techie/penzi.git main
                        else
                            echo "Cloning..."
                            git clone https://${GIT_USER}:${GIT_TOKEN}@github.com/jobu-techie/penzi.git ${DEPLOY_DIR}/penzi
                        fi
                    '''
                }
            }
        }
        stage('Setup Environment') {
            steps {
                withCredentials([file(credentialsId: 'penzi-env-file', variable: 'ENV_FILE')]) {
                    sh '''
                        cp ${ENV_FILE} ${DEPLOY_DIR}/penzi/backend/.env
                        echo ".env file copied successfully"
                    '''
                }
            }
        }
        stage('Build & Deploy') {
            steps {
                sh '''
                    cd ${DEPLOY_DIR}/penzi
                    # Stop existing containers
                    docker compose --env-file ${COMPOSE_ENV_FILE} down || true
                    # Build and start all services
                    docker compose --env-file ${COMPOSE_ENV_FILE} up -d --build
                    echo "Deployment complete!"
                '''
            }
        }
        stage('Run Migrations') {
            steps {
                sh '''
                    echo "Waiting for backend to be ready..."
                    sleep 15

                    # Find the backend container name
                    BACKEND_CONTAINER=$(docker compose -f ${DEPLOY_DIR}/penzi/docker-compose.yml --env-file ${DEPLOY_DIR}/penzi/${COMPOSE_ENV_FILE} ps -q api 2>/dev/null || \
                                        docker ps --filter "name=penzi-api" -q | head -1)

                    if [ -z "$BACKEND_CONTAINER" ]; then
                        echo "ERROR: Could not find backend container"
                        docker ps
                        exit 1
                    fi

                    echo "Found backend container: $BACKEND_CONTAINER"

                    # Run migrations inside the container
                    docker exec $BACKEND_CONTAINER flask db migrate -m "auto migration" || echo "Nothing new to migrate"
                    docker exec $BACKEND_CONTAINER flask db upgrade
                    echo "Migrations complete!"
                '''
            }
        }
        stage('Verify') {
            steps {
                sh '''
                    sleep 5
                    docker compose -f ${DEPLOY_DIR}/penzi/docker-compose.yml --env-file ${DEPLOY_DIR}/penzi/${COMPOSE_ENV_FILE} ps
                '''
            }
        }
    }
    post {
        success {
            echo 'Deployment successful! App is running at http://52.48.121.185:5000'
        }
        failure {
            echo 'Deployment failed! Check logs above.'
            sh 'docker compose -f ${DEPLOY_DIR}/penzi/docker-compose.yml --env-file ${DEPLOY_DIR}/penzi/${COMPOSE_ENV_FILE} logs --tail=50 || true'
        }
    }
}
