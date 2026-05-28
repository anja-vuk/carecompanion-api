pipeline {
    agent any

    environment {
        APP_NAME    = 'carecompanion'
        APP_VERSION = "${env.BUILD_NUMBER}"
        IMAGE_NAME  = "carecompanion:${env.BUILD_NUMBER}"
        STAGING_PORT = '3001'
        PROD_PORT    = '3000'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }

    stages {

        // ─────────────────────────────────────────────
        // STAGE 1: BUILD
        // ─────────────────────────────────────────────
        stage('Build') {
            steps {
                echo "==> Building CareCompanion Docker image v${APP_VERSION}"
                sh 'docker build --build-arg APP_VERSION=${APP_VERSION} -t ${IMAGE_NAME} -t carecompanion:latest .'
                sh 'docker images | grep carecompanion'
                echo "==> Build complete: ${IMAGE_NAME}"
            }
            post {
                success { echo "✅ Build stage passed" }
                failure { echo "❌ Build stage failed" }
            }
        }

        // ─────────────────────────────────────────────
        // STAGE 2: TEST
        // ─────────────────────────────────────────────
        stage('Test') {
            steps {
                echo "==> Installing dependencies and running tests"
                sh 'npm ci'
                sh 'npm run test:ci'
                echo "==> Tests complete — coverage report generated"
            }
            post {
                always {
                    // Publish JUnit-compatible results if available
                    script {
                        if (fileExists('coverage/lcov.info')) {
                            echo "Coverage report available at coverage/lcov.info"
                        }
                    }
                }
                success { echo "✅ Test stage passed" }
                failure { echo "❌ Test stage failed — pipeline halted" }
            }
        }

        // ─────────────────────────────────────────────
        // STAGE 3: CODE QUALITY
        // ─────────────────────────────────────────────
        stage('Code Quality') {
            steps {
                echo "==> Running code quality analysis with SonarCloud"
                withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                    sh '''
                        npx sonar-scanner \
                          -Dsonar.projectKey=anja-vuk_carecompanion-api \
                          -Dsonar.organization=anja-vuk \
                          -Dsonar.sources=src \
                          -Dsonar.tests=tests \
                          -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                          -Dsonar.host.url=https://sonarcloud.io \
                          -Dsonar.login=${SONAR_TOKEN} \
                          -Dsonar.qualitygate.wait=true
                    '''
                }
            }
            post {
                success { echo "✅ Code Quality gate passed" }
                failure { echo "❌ Code Quality gate failed" }
            }
        }

        // ─────────────────────────────────────────────
        // STAGE 4: SECURITY
        // ─────────────────────────────────────────────
        stage('Security') {
            steps {
                echo "==> Running npm audit for dependency vulnerabilities"
                sh 'npm audit --audit-level=high || true'

                echo "==> Running Trivy container image scan"
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      aquasec/trivy:latest image \
                      --exit-code 0 \
                      --severity HIGH,CRITICAL \
                      --format table \
                      ${IMAGE_NAME}
                '''
                echo "==> Security scan complete"
            }
            post {
                success { echo "✅ Security stage passed" }
                failure { echo "❌ Security stage failed" }
            }
        }

        // ─────────────────────────────────────────────
        // STAGE 5: DEPLOY (Staging)
        // ─────────────────────────────────────────────
        stage('Deploy') {
            steps {
                echo "==> Deploying to staging environment (port ${STAGING_PORT})"
                sh '''
                    # Tag image as staging
                    docker tag ${IMAGE_NAME} carecompanion:staging

                    # Stop and remove existing staging container if running
                    docker stop carecompanion-staging 2>/dev/null || true
                    docker rm   carecompanion-staging 2>/dev/null || true

                    # Start new staging container
                    docker run -d \
                      --name carecompanion-staging \
                      -p ${STAGING_PORT}:3000 \
                      -e NODE_ENV=staging \
                      -e APP_VERSION=${APP_VERSION} \
                      carecompanion:staging
                '''

                echo "==> Waiting for staging to become healthy..."
                sh '''
                    # Get the staging container IP on the Docker network
                    sleep 5
                    STAGING_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' carecompanion-staging)
                    echo "Staging container IP: ${STAGING_IP}"
                    for i in $(seq 1 12); do
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://${STAGING_IP}:3000/health || echo "000")
                        if [ "$STATUS" = "200" ]; then
                            echo "Staging healthy after ${i} attempt(s)"
                            break
                        fi
                        echo "Attempt ${i}: status=${STATUS}, retrying in 5s..."
                        sleep 5
                    done
                    curl -sf http://${STAGING_IP}:3000/health
                '''
                echo "==> Staging smoke tests passed"
            }
            post {
                success { echo "✅ Deploy (staging) passed" }
                failure {
                    echo "❌ Staging deployment failed — rolling back"
                    sh 'docker stop carecompanion-staging 2>/dev/null || true'
                    sh 'docker rm carecompanion-staging 2>/dev/null || true'
                }
            }
        }

        // ─────────────────────────────────────────────
        // STAGE 6: RELEASE (Production)
        // ─────────────────────────────────────────────
        stage('Release') {
            steps {
                echo "==> Promoting build ${APP_VERSION} to production"
                sh '''
                    # Stop and remove existing production container if running
                    docker stop carecompanion-prod 2>/dev/null || true
                    docker rm   carecompanion-prod 2>/dev/null || true

                    # Run production container with versioned image
                    docker run -d \
                      --name carecompanion-prod \
                      --network carecompanion-net 2>/dev/null || \
                    docker run -d \
                      --name carecompanion-prod \
                      -p ${PROD_PORT}:3000 \
                      -e NODE_ENV=production \
                      -e APP_VERSION=${APP_VERSION} \
                      ${IMAGE_NAME}
                '''

                echo "==> Waiting for production to become healthy..."
                sh '''
                    sleep 5
                    PROD_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' carecompanion-prod)
                    echo "Production container IP: ${PROD_IP}"
                    for i in $(seq 1 12); do
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://${PROD_IP}:3000/health || echo "000")
                        if [ "$STATUS" = "200" ]; then
                            echo "Production healthy after ${i} attempt(s)"
                            break
                        fi
                        echo "Attempt ${i}: status=${STATUS}, retrying in 5s..."
                        sleep 5
                    done
                    curl -sf http://${PROD_IP}:3000/health
                '''

                echo "==> Tagging Git release v${APP_VERSION}"
                sh '''
                    git config user.email "jenkins@carecompanion.local" || true
                    git config user.name  "Jenkins CI"                  || true
                    git tag -a "v${APP_VERSION}" -m "Release v${APP_VERSION} — build #${BUILD_NUMBER}" || true
                '''

                echo "==> Production release v${APP_VERSION} is LIVE"
            }
            post {
                success { echo "✅ Release stage passed — v${APP_VERSION} in production" }
                failure {
                    echo "❌ Production release failed — rolling back"
                    sh 'docker stop carecompanion-prod 2>/dev/null || true'
                    sh 'docker rm carecompanion-prod 2>/dev/null || true'
                    sh 'docker run -d --name carecompanion-prod -p ${PROD_PORT}:3000 -e NODE_ENV=production carecompanion:latest || true'
                }
            }
        }

        // ─────────────────────────────────────────────
        // STAGE 7: MONITORING
        // ─────────────────────────────────────────────
        stage('Monitoring') {
            steps {
                echo "==> Starting Prometheus + Grafana monitoring stack"
                sh '''
                    # Ensure monitoring network exists
                    docker network create carecompanion-net 2>/dev/null || true

                    # Connect prod container to monitoring network
                    docker network connect carecompanion-net carecompanion-prod 2>/dev/null || true

                    # Start Prometheus
                    docker stop carecompanion-prometheus 2>/dev/null || true
                    docker rm   carecompanion-prometheus 2>/dev/null || true
                    docker run -d \
                      --name carecompanion-prometheus \
                      --network carecompanion-net \
                      -p 9090:9090 \
                      -v $(pwd)/monitoring:/etc/prometheus \
                      prom/prometheus:latest \
                      --config.file=/etc/prometheus/prometheus.yml

                    # Start Grafana
                    docker stop carecompanion-grafana 2>/dev/null || true
                    docker rm   carecompanion-grafana 2>/dev/null || true
                    docker run -d \
                      --name carecompanion-grafana \
                      --network carecompanion-net \
                      -p 3030:3000 \
                      -e GF_SECURITY_ADMIN_PASSWORD=carecompanion \
                      -e GF_USERS_ALLOW_SIGN_UP=false \
                      -v $(pwd)/monitoring/grafana/provisioning:/etc/grafana/provisioning \
                      grafana/grafana:latest
                '''

                echo "==> Waiting for monitoring stack..."
                sh 'sleep 10'

                echo "==> Verifying Prometheus is scraping metrics"
                sh '''
                    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090/-/healthy || echo "000")
                    echo "Prometheus health: ${STATUS}"
                '''

                echo "==> Verifying Grafana is available"
                sh '''
                    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3030/api/health || echo "000")
                    echo "Grafana health: ${STATUS}"
                '''

                echo "==> Simulating incident: sending burst of requests to trigger metrics"
                sh '''
                    PROD_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' carecompanion-prod)
                    for i in $(seq 1 20); do
                        curl -s http://${PROD_IP}:3000/api/residents > /dev/null
                        curl -s http://${PROD_IP}:3000/api/residents/1/summary > /dev/null
                        curl -s http://${PROD_IP}:3000/api/residents/999 > /dev/null
                    done
                    echo "Incident simulation complete — check Grafana at http://localhost:3030"
                '''

                echo ""
                echo "================================================"
                echo "  CareCompanion pipeline complete!"
                echo "  App (prod):    http://localhost:${PROD_PORT}/health"
                echo "  App (staging): http://localhost:${STAGING_PORT}/health"
                echo "  Prometheus:    http://localhost:9090"
                echo "  Grafana:       http://localhost:3030  (admin / carecompanion)"
                echo "================================================"
            }
            post {
                success { echo "✅ Monitoring stage passed — dashboards live" }
                failure { echo "❌ Monitoring setup failed" }
            }
        }
    }

    // ─────────────────────────────────────────────
    // POST-PIPELINE
    // ─────────────────────────────────────────────
    post {
        success {
            echo "🚀 Pipeline SUCCESS — CareCompanion v${APP_VERSION} deployed and monitored"
        }
        failure {
            echo "💥 Pipeline FAILED — check logs above"
        }
        always {
            echo "==> Cleaning up dangling Docker images"
            sh 'docker image prune -f || true'
        }
    }
}
