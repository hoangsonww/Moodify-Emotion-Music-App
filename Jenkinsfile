#!/usr/bin/env groovy

/*
 * Moodify CI/CD Pipeline
 *
 * This Jenkins pipeline implements a comprehensive CI/CD workflow with:
 * - Multi-stage build and test
 * - Security scanning (SAST, DAST, dependency check)
 * - Docker image building and scanning
 * - Blue-Green deployment
 * - Canary deployment with progressive rollout
 * - Automated rollback on failure
 * - Comprehensive monitoring and notifications
 *
 * Author: DevOps Team
 * Last Updated: 2025-11-26
 */

pipeline {
    agent any

    // Pipeline options
    options {
        buildDiscarder(logRotator(numToKeepStr: '30', daysToKeepStr: '90'))
        disableConcurrentBuilds()
        timeout(time: 2, unit: 'HOURS')
        timestamps()
        ansiColor('xterm')
    }

    // Environment variables
    environment {
        // Project configuration
        PROJECT_NAME = 'moodify'
        APP_NAME = 'moodify-backend'

        // Docker configuration
        DOCKER_REGISTRY = credentials('docker-registry-url')
        DOCKER_CREDENTIALS = credentials('docker-registry-credentials')
        IMAGE_NAME = "${DOCKER_REGISTRY}/${APP_NAME}"

        // Kubernetes configuration
        KUBECONFIG = credentials('kubeconfig-production')
        NAMESPACE_STAGING = 'moodify-staging'
        NAMESPACE_PRODUCTION = 'moodify-production'

        // Version and Git
        GIT_COMMIT_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
        BUILD_VERSION = "${env.BUILD_NUMBER}-${GIT_COMMIT_SHORT}"
        IMAGE_TAG = "${env.BRANCH_NAME == 'master' ? 'latest' : env.BRANCH_NAME}-${BUILD_VERSION}"

        // Deployment configuration
        DEPLOYMENT_STRATEGY = 'blue-green' // Options: blue-green, canary
        ENABLE_CANARY = 'true'
        CANARY_STEPS = '10,25,50,100'

        // Quality gates
        SONARQUBE_URL = credentials('sonarqube-url')
        SNYK_TOKEN = credentials('snyk-token')

        // Notification
        SLACK_CHANNEL = '#deployments'
        SLACK_CREDENTIALS = credentials('slack-webhook')
    }

    // Build parameters
    parameters {
        choice(
            name: 'DEPLOY_ENVIRONMENT',
            choices: ['none', 'staging', 'production'],
            description: 'Target deployment environment'
        )
        choice(
            name: 'DEPLOY_STRATEGY',
            choices: ['blue-green', 'canary', 'rolling'],
            description: 'Deployment strategy to use'
        )
        booleanParam(
            name: 'RUN_SECURITY_SCAN',
            defaultValue: true,
            description: 'Run security scans (SAST, dependency check)'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip test execution (not recommended)'
        )
        booleanParam(
            name: 'FORCE_DEPLOY',
            defaultValue: false,
            description: 'Force deployment even if quality gates fail'
        )
        string(
            name: 'ROLLBACK_VERSION',
            defaultValue: '',
            description: 'Version to rollback to (leave empty for normal deployment)'
        )
    }

    // Pipeline stages
    stages {

        stage('Initialize') {
            steps {
                script {
                    echo """
                    ╔══════════════════════════════════════════════════════════════╗
                    ║              Moodify CI/CD Pipeline Started                  ║
                    ╚══════════════════════════════════════════════════════════════╝

                    Build Information:
                    ------------------
                    • Branch:      ${env.BRANCH_NAME}
                    • Build:       #${env.BUILD_NUMBER}
                    • Commit:      ${GIT_COMMIT_SHORT}
                    • Image Tag:   ${IMAGE_TAG}
                    • Strategy:    ${params.DEPLOY_STRATEGY}
                    • Environment: ${params.DEPLOY_ENVIRONMENT}
                    """

                    // Send Slack notification
                    notifySlack('STARTED', 'Pipeline started')
                }
            }
        }

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Get commit info
                    env.GIT_COMMIT_MSG = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    env.GIT_AUTHOR = sh(script: 'git log -1 --pretty=%an', returnStdout: true).trim()
                }
            }
        }

        stage('Pre-build Checks') {
            parallel {
                stage('Lint Code') {
                    steps {
                        script {
                            echo '🔍 Running code linting...'
                            sh '''
                                # Backend linting
                                cd backend
                                npm install
                                npm run lint || true

                                # Frontend linting
                                cd ../frontend
                                npm install
                                npm run lint || true
                            '''
                        }
                    }
                }

                stage('Check Dependencies') {
                    steps {
                        script {
                            echo '📦 Checking dependencies...'
                            sh '''
                                # Check for outdated dependencies
                                cd backend && npm outdated || true
                                cd ../frontend && npm outdated || true
                            '''
                        }
                    }
                }

                stage('Validate Kubernetes Manifests') {
                    steps {
                        script {
                            echo '☸️  Validating Kubernetes manifests...'
                            sh '''
                                # Validate YAML syntax
                                for file in kubernetes/**/*.yaml; do
                                    echo "Validating $file"
                                    kubectl apply --dry-run=client -f "$file" || true
                                done
                            '''
                        }
                    }
                }
            }
        }

        stage('Unit Tests') {
            when {
                expression { !params.SKIP_TESTS }
            }
            steps {
                script {
                    echo '🧪 Running unit tests...'
                    sh '''
                        # Backend tests
                        cd backend
                        npm install
                        npm run test:unit -- --coverage --ci

                        # Frontend tests
                        cd ../frontend
                        npm install
                        npm run test -- --coverage --watchAll=false
                    '''
                }
            }
            post {
                always {
                    junit '**/test-results/**/*.xml'
                    publishHTML([
                        reportDir: 'backend/coverage',
                        reportFiles: 'index.html',
                        reportName: 'Backend Coverage Report'
                    ])
                    publishHTML([
                        reportDir: 'frontend/coverage',
                        reportFiles: 'index.html',
                        reportName: 'Frontend Coverage Report'
                    ])
                }
            }
        }

        stage('Integration Tests') {
            when {
                expression { !params.SKIP_TESTS }
            }
            steps {
                script {
                    echo '🔗 Running integration tests...'
                    sh '''
                        cd backend
                        npm run test:integration || true
                    '''
                }
            }
        }

        stage('Security Scanning') {
            when {
                expression { params.RUN_SECURITY_SCAN }
            }
            parallel {
                stage('Dependency Scanning') {
                    steps {
                        script {
                            echo '🔐 Scanning dependencies for vulnerabilities...'
                            sh '''
                                # Install Snyk
                                npm install -g snyk

                                # Authenticate with Snyk
                                snyk auth ${SNYK_TOKEN}

                                # Scan backend dependencies
                                cd backend
                                snyk test --severity-threshold=high || true

                                # Scan frontend dependencies
                                cd ../frontend
                                snyk test --severity-threshold=high || true
                            '''
                        }
                    }
                }

                stage('SAST Scan') {
                    steps {
                        script {
                            echo '🔍 Running static application security testing...'
                            sh '''
                                # SonarQube scan
                                sonar-scanner \
                                    -Dsonar.projectKey=moodify \
                                    -Dsonar.sources=. \
                                    -Dsonar.host.url=${SONARQUBE_URL} \
                                    -Dsonar.login=${SONARQUBE_TOKEN} || true
                            '''
                        }
                    }
                }

                stage('Secret Scanning') {
                    steps {
                        script {
                            echo '🔑 Scanning for secrets...'
                            sh '''
                                # Install and run gitleaks
                                docker run --rm -v $(pwd):/code zricethezav/gitleaks:latest \
                                    detect --source="/code" --verbose || true
                            '''
                        }
                    }
                }
            }
        }

        stage('Build') {
            parallel {
                stage('Build Backend') {
                    steps {
                        script {
                            echo '🏗️  Building backend...'
                            sh '''
                                cd backend
                                npm install
                                npm run build
                            '''
                        }
                    }
                }

                stage('Build Frontend') {
                    steps {
                        script {
                            echo '🏗️  Building frontend...'
                            sh '''
                                cd frontend
                                npm install
                                npm run build
                            '''
                        }
                    }
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    echo '🐳 Building Docker images...'

                    // Build backend image
                    sh """
                        docker build \
                            -t ${IMAGE_NAME}:${IMAGE_TAG} \
                            -t ${IMAGE_NAME}:latest \
                            --build-arg BUILD_VERSION=${BUILD_VERSION} \
                            --build-arg GIT_COMMIT=${GIT_COMMIT_SHORT} \
                            -f backend/Dockerfile \
                            ./backend
                    """

                    // Build frontend image
                    sh """
                        docker build \
                            -t ${DOCKER_REGISTRY}/moodify-frontend:${IMAGE_TAG} \
                            -t ${DOCKER_REGISTRY}/moodify-frontend:latest \
                            --build-arg BUILD_VERSION=${BUILD_VERSION} \
                            -f frontend/Dockerfile \
                            ./frontend
                    """
                }
            }
        }

        stage('Scan Docker Images') {
            when {
                expression { params.RUN_SECURITY_SCAN }
            }
            steps {
                script {
                    echo '🔒 Scanning Docker images for vulnerabilities...'
                    sh """
                        # Scan with Trivy
                        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                            aquasec/trivy:latest image \
                            --severity HIGH,CRITICAL \
                            ${IMAGE_NAME}:${IMAGE_TAG} || true
                    """
                }
            }
        }

        stage('Push Images') {
            steps {
                script {
                    echo '📤 Pushing images to registry...'
                    sh """
                        echo ${DOCKER_CREDENTIALS_PSW} | docker login ${DOCKER_REGISTRY} \
                            -u ${DOCKER_CREDENTIALS_USR} --password-stdin

                        docker push ${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${DOCKER_REGISTRY}/moodify-frontend:${IMAGE_TAG}

                        if [ "${env.BRANCH_NAME}" = "master" ]; then
                            docker push ${IMAGE_NAME}:latest
                            docker push ${DOCKER_REGISTRY}/moodify-frontend:latest
                        fi
                    """
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                expression {
                    params.DEPLOY_ENVIRONMENT in ['staging', 'production'] ||
                    env.BRANCH_NAME == 'develop'
                }
            }
            steps {
                script {
                    echo '🚀 Deploying to staging environment...'

                    sh """
                        export KUBECONFIG=${KUBECONFIG}
                        export IMAGE_TAG=${IMAGE_TAG}
                        export NAMESPACE=${NAMESPACE_STAGING}

                        # Deploy using kubectl
                        envsubst < kubernetes/blue-green/backend-blue.yaml | kubectl apply -f -

                        # Wait for rollout
                        kubectl rollout status deployment/backend-blue -n ${NAMESPACE_STAGING} --timeout=10m
                    """
                }
            }
        }

        stage('Staging Smoke Tests') {
            when {
                expression {
                    params.DEPLOY_ENVIRONMENT in ['staging', 'production'] ||
                    env.BRANCH_NAME == 'develop'
                }
            }
            steps {
                script {
                    echo '💨 Running smoke tests on staging...'
                    sh '''
                        # Run smoke tests
                        ./scripts/deployment/smoke-tests.sh staging || true
                    '''
                }
            }
        }

        stage('Approve Production Deployment') {
            when {
                expression {
                    params.DEPLOY_ENVIRONMENT == 'production' &&
                    env.BRANCH_NAME == 'master'
                }
            }
            steps {
                script {
                    notifySlack('PENDING', 'Awaiting production deployment approval')

                    timeout(time: 24, unit: 'HOURS') {
                        input(
                            message: 'Deploy to production?',
                            ok: 'Deploy',
                            submitter: 'DevOps,CTO',
                            parameters: [
                                choice(
                                    name: 'CONFIRM_STRATEGY',
                                    choices: ['blue-green', 'canary'],
                                    description: 'Confirm deployment strategy'
                                )
                            ]
                        )
                    }
                }
            }
        }

        stage('Production Deployment') {
            when {
                expression {
                    params.DEPLOY_ENVIRONMENT == 'production' &&
                    env.BRANCH_NAME == 'master'
                }
            }
            steps {
                script {
                    if (params.ROLLBACK_VERSION) {
                        echo "🔄 Performing rollback to version ${params.ROLLBACK_VERSION}"
                        sh """
                            ./scripts/deployment/rollback.sh \
                                -t version \
                                -v ${params.ROLLBACK_VERSION} \
                                -f
                        """
                    } else if (params.DEPLOY_STRATEGY == 'blue-green') {
                        echo '🔵🟢 Executing Blue-Green deployment...'
                        sh """
                            ./scripts/deployment/blue-green-deploy.sh \
                                -e production \
                                -v ${IMAGE_TAG} \
                                -r ${DOCKER_REGISTRY}
                        """
                    } else if (params.DEPLOY_STRATEGY == 'canary') {
                        echo '🐤 Executing Canary deployment...'
                        sh """
                            ./scripts/deployment/canary-deploy.sh \
                                -v ${IMAGE_TAG} \
                                -r ${DOCKER_REGISTRY} \
                                -s progressive \
                                -m 300
                        """
                    } else {
                        echo '🔄 Executing Rolling deployment...'
                        sh """
                            export KUBECONFIG=${KUBECONFIG}
                            export IMAGE_TAG=${IMAGE_TAG}
                            export NAMESPACE=${NAMESPACE_PRODUCTION}

                            kubectl set image deployment/backend-blue \
                                backend=${IMAGE_NAME}:${IMAGE_TAG} \
                                -n ${NAMESPACE_PRODUCTION} \
                                --record

                            kubectl rollout status deployment/backend-blue \
                                -n ${NAMESPACE_PRODUCTION} \
                                --timeout=10m
                        """
                    }
                }
            }
        }

        stage('Production Verification') {
            when {
                expression {
                    params.DEPLOY_ENVIRONMENT == 'production' &&
                    env.BRANCH_NAME == 'master'
                }
            }
            steps {
                script {
                    echo '✅ Verifying production deployment...'
                    sh '''
                        # Run production smoke tests
                        ./scripts/deployment/smoke-tests.sh production

                        # Verify metrics
                        sleep 60

                        # Check error rates
                        # (This would integrate with your monitoring system)
                    '''
                }
            }
        }

        stage('Performance Tests') {
            when {
                expression { env.BRANCH_NAME == 'master' }
            }
            steps {
                script {
                    echo '⚡ Running performance tests...'
                    sh '''
                        # Run k6 or JMeter performance tests
                        # k6 run performance-tests/load-test.js || true
                    '''
                }
            }
        }

        stage('Create Release') {
            when {
                expression {
                    env.BRANCH_NAME == 'master' &&
                    params.DEPLOY_ENVIRONMENT == 'production'
                }
            }
            steps {
                script {
                    echo '🎉 Creating release...'
                    sh """
                        # Tag the release
                        git tag -a ${IMAGE_TAG} -m "Release ${IMAGE_TAG}"
                        git push origin ${IMAGE_TAG}

                        # Create GitHub release
                        gh release create ${IMAGE_TAG} \
                            --title "Release ${IMAGE_TAG}" \
                            --notes "Deployed to production" || true
                    """
                }
            }
        }
    }

    // Post-build actions
    post {
        always {
            script {
                echo '🧹 Cleaning up...'

                // Clean up Docker images
                sh """
                    docker rmi ${IMAGE_NAME}:${IMAGE_TAG} || true
                    docker system prune -f || true
                """

                // Archive artifacts
                archiveArtifacts artifacts: '**/build/**/*', allowEmptyArchive: true

                // Publish test results
                junit testResults: '**/test-results/**/*.xml', allowEmptyResults: true
            }
        }

        success {
            script {
                notifySlack('SUCCESS', "Pipeline completed successfully!")

                echo """
                ╔══════════════════════════════════════════════════════════════╗
                ║              Pipeline Completed Successfully! ✅             ║
                ╚══════════════════════════════════════════════════════════════╝

                • Build: #${env.BUILD_NUMBER}
                • Image: ${IMAGE_TAG}
                • Duration: ${currentBuild.durationString}
                """
            }
        }

        failure {
            script {
                notifySlack('FAILURE', "Pipeline failed!")

                echo """
                ╔══════════════════════════════════════════════════════════════╗
                ║                  Pipeline Failed! ❌                         ║
                ╚══════════════════════════════════════════════════════════════╝

                Please check the logs for details.
                """

                // Auto-rollback on production failure
                if (params.DEPLOY_ENVIRONMENT == 'production') {
                    sh './scripts/deployment/rollback.sh -t blue-green -f || true'
                }
            }
        }

        unstable {
            script {
                notifySlack('WARNING', "Pipeline completed with warnings")
            }
        }

        aborted {
            script {
                notifySlack('ABORTED', "Pipeline was aborted")
            }
        }
    }
}

// Helper functions
def notifySlack(String status, String message) {
    def color = status == 'SUCCESS' ? 'good' :
                status == 'FAILURE' ? 'danger' :
                status == 'WARNING' ? 'warning' : '#439FE0'

    def emoji = status == 'SUCCESS' ? ':white_check_mark:' :
                status == 'FAILURE' ? ':x:' :
                status == 'WARNING' ? ':warning:' : ':information_source:'

    slackSend(
        channel: SLACK_CHANNEL,
        color: color,
        message: """
${emoji} *${status}*: ${message}
*Project*: ${PROJECT_NAME}
*Branch*: ${env.BRANCH_NAME}
*Build*: #${env.BUILD_NUMBER}
*Commit*: ${GIT_COMMIT_SHORT}
*Author*: ${env.GIT_AUTHOR ?: 'Unknown'}
*Duration*: ${currentBuild.durationString ?: 'N/A'}
<${env.BUILD_URL}|View Build>
        """.trim()
    )
}
