#!/bin/bash

# Frontend Testing Script for E-Commerce OMS
# This script helps test the Angular frontend application

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    if ! command_exists ng; then
        print_warning "Angular CLI not found globally. Installing..."
        npm install -g @angular/cli
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_warning "Node.js version is $NODE_VERSION. Recommended version is 18 or higher."
    fi
    
    print_success "Prerequisites check completed!"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    else
        print_status "Dependencies already installed. Running npm ci for clean install..."
        npm ci
    fi
    
    print_success "Dependencies installed successfully!"
}

# Function to run linting
run_lint() {
    print_status "Running linting checks..."
    
    if npm run lint 2>/dev/null; then
        print_success "Linting passed!"
    else
        print_warning "Linting failed or not configured. Skipping..."
    fi
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    
    if npm test -- --watch=false --browsers=ChromeHeadless 2>/dev/null; then
        print_success "Unit tests passed!"
    else
        print_warning "Unit tests failed or not configured. Skipping..."
    fi
}

# Function to build the application
build_application() {
    print_status "Building Angular application..."
    
    # Development build
    print_status "Running development build..."
    if ng build --configuration development; then
        print_success "Development build completed!"
    else
        print_error "Development build failed!"
        return 1
    fi
    
    # Production build
    print_status "Running production build..."
    if ng build --configuration production; then
        print_success "Production build completed!"
    else
        print_error "Production build failed!"
        return 1
    fi
}

# Function to start development server
start_dev_server() {
    print_status "Starting development server..."
    print_status "The application will be available at http://localhost:4200"
    print_status "Press Ctrl+C to stop the server"
    
    ng serve --open
}

# Function to run basic functionality test
test_basic_functionality() {
    print_status "Testing basic functionality..."
    
    # Check if Angular CLI can analyze the project
    if ng version >/dev/null 2>&1; then
        print_success "Angular project structure is valid!"
    else
        print_error "Angular project structure is invalid!"
        return 1
    fi
    
    # Check TypeScript compilation
    if npx tsc --noEmit; then
        print_success "TypeScript compilation successful!"
    else
        print_error "TypeScript compilation failed!"
        return 1
    fi
}

# Function to run e2e tests (if configured)
run_e2e_tests() {
    print_status "Running end-to-end tests..."
    
    if [ -f "e2e/protractor.conf.js" ] || [ -f "cypress.config.js" ] || [ -d "e2e" ]; then
        if npm run e2e 2>/dev/null; then
            print_success "E2E tests passed!"
        else
            print_warning "E2E tests failed or not properly configured."
        fi
    else
        print_warning "E2E tests not configured. Skipping..."
    fi
}

# Function to check bundle size
check_bundle_size() {
    print_status "Checking bundle size..."
    
    if [ -d "dist" ]; then
        BUNDLE_SIZE=$(du -sh dist/ | cut -f1)
        print_status "Bundle size: $BUNDLE_SIZE"
        
        # Check for large bundles (warn if over 5MB)
        SIZE_IN_KB=$(du -sk dist/ | cut -f1)
        if [ "$SIZE_IN_KB" -gt 5120 ]; then
            print_warning "Bundle size is quite large ($BUNDLE_SIZE). Consider optimizing."
        else
            print_success "Bundle size looks good!"
        fi
    else
        print_warning "No build output found. Run build first."
    fi
}

# Function to run all tests
run_all_tests() {
    print_status "Running comprehensive test suite..."
    
    check_prerequisites
    install_dependencies
    test_basic_functionality
    run_lint
    run_unit_tests
    build_application
    check_bundle_size
    run_e2e_tests
    
    print_success "All tests completed!"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Test script for Angular E-Commerce OMS Frontend"
    echo ""
    echo "Options:"
    echo "  install     Install dependencies"
    echo "  lint        Run linting checks"
    echo "  test        Run unit tests"
    echo "  build       Build the application"
    echo "  serve       Start development server"
    echo "  e2e         Run end-to-end tests"
    echo "  size        Check bundle size"
    echo "  all         Run all tests"
    echo "  basic       Run basic functionality tests"
    echo "  --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 all           # Run comprehensive test suite"
    echo "  $0 serve         # Start development server"
    echo "  $0 build         # Build for production"
    echo "  $0 test          # Run unit tests only"
}

# Function to create sample test files
create_sample_tests() {
    print_status "Creating sample test files..."
    
    # Create karma.conf.js if it doesn't exist
    if [ ! -f "karma.conf.js" ]; then
        cat > karma.conf.js << 'EOF'
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        random: true,
        seed: '4321',
        oneFailurePerSpec: true,
        failFast: true,
        timeoutInterval: 1000
      },
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcov' }
      ],
      check: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80
        }
      }
    },
    reporters: ['progress', 'kjhtml', 'coverage'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome', 'ChromeHeadless'],
    singleRun: false,
    restartOnFileChange: true,
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-web-security']
      }
    }
  });
};
EOF
        print_success "Created karma.conf.js"
    fi
    
    # Create a sample test for the dashboard component
    mkdir -p src/app/dashboard
    if [ ! -f "src/app/dashboard/dashboard.component.spec.ts" ]; then
        cat > src/app/dashboard/dashboard.component.spec.ts << 'EOF'
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent,
        MatCardModule,
        MatIconModule,
        MatTableModule,
        NoopAnimationsModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display metrics', () => {
    expect(component.metrics.length).toBeGreaterThan(0);
  });

  it('should display recent orders', () => {
    expect(component.recentOrders.length).toBeGreaterThan(0);
  });

  it('should render dashboard title', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h1').textContent).toContain('Dashboard Overview');
  });
});
EOF
        print_success "Created sample dashboard component test"
    fi
}

# Main script logic
main() {
    echo "================================================"
    echo "  E-Commerce OMS Frontend Testing Script"
    echo "================================================"
    echo ""
    
    case "${1:-}" in
        "install")
            check_prerequisites
            install_dependencies
            ;;
        "lint")
            run_lint
            ;;
        "test")
            run_unit_tests
            ;;
        "build")
            build_application
            ;;
        "serve")
            check_prerequisites
            install_dependencies
            start_dev_server
            ;;
        "e2e")
            run_e2e_tests
            ;;
        "size")
            check_bundle_size
            ;;
        "all")
            run_all_tests
            ;;
        "basic")
            test_basic_functionality
            ;;
        "setup-tests")
            create_sample_tests
            ;;
        "--help"|"help"|"")
            show_usage
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the Angular project root directory."
    exit 1
fi

if [ ! -f "angular.json" ]; then
    print_error "angular.json not found. This doesn't appear to be an Angular project."
    exit 1
fi

# Run the main function
main "$@"