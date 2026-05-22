pipeline {
    agent any

    environment {
        BACKEND_REPO = 'https://github.com/jobu-techie/penzi.git'
        FRONTEND_REPO = 'https://github.com/jobu-techie/penzi-frontend.git'
        DEPLOY_DIR = '/home/jmiyienda/penzi-deploy'
    }

    stages {

        stage('Clone Repositories') {
            steps {
                sh '''
                    # Create deploy directory
                    mkdir -p ${DEPLOY_DIR}

                    # Clone or pull backend
                    if [ -d "${DEPLOY_DIR}/penzi/.git" ]; then
                        echo "Pulling latest backend..."
                        cd ${DEPLOY_DIR}/penzi && git pull origin main
                    else
                        echo "Cloning backend..."
                        git clone ${BACKEND_REPO} ${DEPLOY_DIR}/penzi
                    fi

                    # Clone or pull frontend
                    if [ -d "${DEPLOY_DIR}/penzi-frontend/.git" ]; then
                        echo "Pulling latest frontend..."
                        cd ${DEPLOY_DIR}/penzi-frontend && git pull origin main
                    else
                        echo "Cloning frontend..."
                        git clone ${FRONTEND_REPO} ${DEPLOY_DIR}/penzi-frontend
                    fi
                '''
            }
        }

        stage('Setup Environment') {
            steps {
                withCredentials([file(credentialsId: 'penzi-env-file', variable: 'ENV_FILE')]) {
                    sh '''
                        cp ${ENV_FILE} ${DEPLOY_DIR}/penzi/.env
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
                    docker compose down || true

                    # Build and start all services
                    docker compose up -d --build

                    echo "Deployment complete!"
                '''
            }
        }

        stage('Verify') {
            steps {
                sh '''
                    sleep 10
                    docker compose -f ${DEPLOY_DIR}/penzi/docker-compose.yml ps
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
            sh 'docker compose -f ${DEPLOY_DIR}/penzi/docker-compose.yml logs --tail=50 || true'
        }
    }
}
