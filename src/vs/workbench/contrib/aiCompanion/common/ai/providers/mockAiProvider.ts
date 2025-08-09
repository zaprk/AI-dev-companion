/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAIProvider, IAIProviderConfig, IAIRequest, IAIResponse, IAIRequirementsResult, IAIDesignResult, IAITaskResult, IAICodeResult } from '../aiProvider.js';
import { IWorkspaceEditService } from '../../workspaceEditService.js';
import { ICodeValidationService } from '../../codeValidationService.js';
import { IIntelligentCodeGenerator } from '../../intelligentCodeGenerator.js';
import { IFeedbackLearningService } from '../../feedbackLearningService.js';
import { IPromptSecurityService } from '../../promptSecurityService.js';
import { ICostOptimizationService } from '../../costOptimizationService.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';

export class MockAIProvider implements IAIProvider {
    constructor(
        public readonly config: IAIProviderConfig,
        private readonly workspaceEditService: IWorkspaceEditService,
        private readonly codeValidationService: ICodeValidationService,
        private readonly intelligentCodeGenerator: IIntelligentCodeGenerator,
        private readonly feedbackLearningService: IFeedbackLearningService,
        private readonly promptSecurityService: IPromptSecurityService,
        private readonly costOptimizationService: ICostOptimizationService,
        private readonly logService: ILogService
    ) {}

    async complete(request: IAIRequest): Promise<IAIResponse> {
        // Extract and sanitize user input
        const lastMessage = request.messages[request.messages.length - 1];
        const sanitizedInput = this.promptSecurityService.sanitizeUserInput(lastMessage.content);
        
        // Check for cached response first
        const promptHash = this.costOptimizationService.generatePromptHash(sanitizedInput);
        const cachedResponse = this.costOptimizationService.getCachedResponse(promptHash);
        
        if (cachedResponse) {
            this.logService.info('⚡ Using cached response for cost optimization');
            return {
                content: cachedResponse,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, // Cached = free
                model: this.config.model,
                finishReason: 'stop'
            };
        }

        // Generate optimized prompt
        const optimizedPrompt = this.costOptimizationService.optimizePrompt(sanitizedInput, 300);
        
        // Simulate API delay
        await this.delay(500 + Math.random() * 1000);

        const content = this.generateMockContent({ ...request, messages: [{ ...lastMessage, content: optimizedPrompt }] });
        
        // Cache the response
        this.costOptimizationService.cacheResponse(promptHash, content);
        
        // Calculate accurate token usage
        const estimatedTokens = this.costOptimizationService.estimateTokenCost(optimizedPrompt, 500);
        
        this.logService.info(`💰 Request cost: $${estimatedTokens.estimatedCost.toFixed(4)} (${estimatedTokens.costLevel})`);
        
        return {
            content,
            usage: {
                promptTokens: estimatedTokens.inputTokens,
                completionTokens: Math.floor(content.length / 4),
                totalTokens: estimatedTokens.inputTokens + Math.floor(content.length / 4)
            },
            model: this.config.model,
            finishReason: 'stop'
        };
    }

    async generateRequirements(prompt: string, context?: string): Promise<IAIRequirementsResult> {
        await this.delay(800);
        
        const result = {
            functional: [
                "User Registration and Authentication System",
                "Product Catalog with Search and Filtering",
                "Shopping Cart and Checkout Process",
                "Order Management and Tracking",
                "Payment Processing Integration",
                "User Profile and Account Management",
                "Admin Dashboard for Product Management",
                "Inventory Management System",
                "Customer Support and Reviews",
                "Email Notifications and Confirmations"
            ],
            nonFunctional: [
                "System should handle 10,000+ concurrent users",
                "Page load times under 2 seconds",
                "99.9% uptime availability",
                "GDPR and PCI DSS compliance",
                "Mobile-responsive design",
                "SEO-optimized architecture",
                "Scalable microservices architecture",
                "Automated testing coverage >80%",
                "Real-time inventory updates",
                "Multi-language support"
            ],
            constraints: [
                "Budget limited to $50,000",
                "Must launch within 6 months",
                "Integration with existing payment systems",
                "Compatible with modern browsers",
                "Must use company-approved tech stack",
                "WCAG 2.1 accessibility compliance",
                "Data residency requirements",
                "Integration with existing CRM system"
            ],
            assumptions: [
                "Users have basic computer literacy",
                "Stable internet connection for users",
                "Product catalog under 10,000 items initially",
                "Single currency support (USD) initially",
                "English language support initially",
                "Desktop and mobile app versions",
                "Credit card payments primary method",
                "Standard shipping options available"
            ],
            reasoning: "Requirements gathered based on modern e-commerce best practices and typical MVP feature set. Functional requirements cover core user journeys from discovery to purchase. Non-functional requirements ensure scalability and performance. Constraints reflect realistic project limitations while assumptions help scope the initial release."
        };

        // Create requirements.md file
        try {
            const requirementsContent = this.formatRequirementsAsMarkdown(result);
            await this.workspaceEditService.applyEdits([{
                type: 'create',
                path: 'docs/requirements.md',
                content: requirementsContent,
                options: { overwrite: true }
            }]);
            this.logService.info('✅ Created requirements.md file');
        } catch (error) {
            this.logService.error('❌ Failed to create requirements.md:', error);
        }

        return result;
    }

    async generateDesign(requirements: IAIRequirementsResult, context?: string): Promise<IAIDesignResult> {
        await this.delay(1200);
        
        const result = {
            folderStructure: {
                "src": {
                    "components": {
                        "ui": ["Button.tsx", "Input.tsx", "Modal.tsx"],
                        "product": ["ProductCard.tsx", "ProductList.tsx", "ProductDetails.tsx"],
                        "cart": ["CartItem.tsx", "CartSummary.tsx", "Checkout.tsx"],
                        "auth": ["LoginForm.tsx", "RegisterForm.tsx", "Profile.tsx"]
                    },
                    "pages": ["Home.tsx", "Products.tsx", "Cart.tsx", "Checkout.tsx", "Profile.tsx"],
                    "hooks": ["useAuth.ts", "useCart.ts", "useProducts.ts"],
                    "services": ["api.ts", "auth.ts", "cart.ts", "products.ts"],
                    "types": ["index.ts", "product.ts", "user.ts", "cart.ts"],
                    "utils": ["validation.ts", "formatting.ts", "constants.ts"]
                },
                "server": {
                    "controllers": ["auth.ts", "products.ts", "orders.ts", "users.ts"],
                    "models": ["User.ts", "Product.ts", "Order.ts", "Cart.ts"],
                    "middleware": ["auth.ts", "validation.ts", "error.ts"],
                    "routes": ["api.ts", "auth.ts", "products.ts", "orders.ts"],
                    "services": ["emailService.ts", "paymentService.ts", "inventoryService.ts"]
                },
                "database": {
                    "migrations": ["001_initial_schema.sql", "002_add_indexes.sql"],
                    "seeds": ["products.sql", "users.sql"]
                },
                "tests": {
                    "unit": ["components", "services", "utils"],
                    "integration": ["api", "auth", "checkout"],
                    "e2e": ["user-flows", "critical-paths"]
                }
            },
            components: [
                "Authentication System (Login/Register/Profile)",
                "Product Catalog (List/Search/Filter/Details)",
                "Shopping Cart (Add/Remove/Update/Persist)",
                "Checkout Process (Shipping/Payment/Confirmation)",
                "Order Management (History/Tracking/Status)",
                "Admin Dashboard (Products/Orders/Users)",
                "Payment Integration (Stripe/PayPal)",
                "Email System (Notifications/Confirmations)",
                "Search Engine (Full-text/Filters)",
                "Responsive UI Components (Mobile/Desktop)"
            ],
            architecture: "Microservices architecture with React frontend, Node.js/Express backend, PostgreSQL database, and Redis for caching. Uses JWT for authentication, Stripe for payments, and AWS for hosting with CDN for static assets.",
            techStack: [
                "Frontend: React 18, TypeScript, Tailwind CSS, React Query",
                "Backend: Node.js, Express, TypeScript, Prisma ORM",
                "Database: PostgreSQL with Redis for caching",
                "Authentication: JWT with refresh tokens",
                "Payments: Stripe API integration",
                "Testing: Jest, React Testing Library, Cypress",
                "DevOps: Docker, AWS ECS, CloudFront CDN",
                "Monitoring: AWS CloudWatch, Sentry for error tracking"
            ],
            dependencies: [
                "react@18.0.0", "typescript@5.0.0", "tailwindcss@3.0.0",
                "express@4.18.0", "prisma@5.0.0", "jsonwebtoken@9.0.0",
                "stripe@12.0.0", "nodemailer@6.9.0", "redis@4.6.0",
                "@types/node@20.0.0", "jest@29.0.0", "cypress@12.0.0"
            ],
            reasoning: "Architecture chosen for scalability and maintainability. React provides excellent user experience with TypeScript ensuring code quality. Microservices allow independent scaling and deployment. PostgreSQL offers ACID compliance for transactions while Redis handles session management and caching. The tech stack is mature, well-documented, and has strong community support."
        };

        // Create design.md file
        try {
            const designContent = this.formatDesignAsMarkdown(result);
            await this.workspaceEditService.applyEdits([{
                type: 'create',
                path: 'docs/design.md',
                content: designContent,
                options: { overwrite: true }
            }]);
            this.logService.info('✅ Created design.md file');
        } catch (error) {
            this.logService.error('❌ Failed to create design.md:', error);
        }

        return result;
    }

    async generateTasks(requirements: IAIRequirementsResult, design: IAIDesignResult, context?: string): Promise<IAITaskResult> {
        await this.delay(1000);
        
        const result = {
            tasks: [
                {
                    title: "Project Setup and Configuration",
                    description: "Initialize the project structure, configure build tools, set up TypeScript, and establish development environment",
                    filePath: "package.json",
                    dependencies: [],
                    estimatedTime: "4 hours",
                    complexity: "low" as const
                },
                {
                    title: "Database Schema and Models",
                    description: "Design and implement database schema with Prisma, create migration files, and set up model relationships",
                    filePath: "prisma/schema.prisma",
                    dependencies: ["Project Setup and Configuration"],
                    estimatedTime: "6 hours",
                    complexity: "medium" as const
                },
                {
                    title: "Authentication System Backend",
                    description: "Implement JWT-based authentication, password hashing, user registration, login, and token refresh",
                    filePath: "server/controllers/auth.ts",
                    dependencies: ["Database Schema and Models"],
                    estimatedTime: "8 hours",
                    complexity: "high" as const
                },
                {
                    title: "Product Management API",
                    description: "Create RESTful API endpoints for product CRUD operations, search functionality, and category management",
                    filePath: "server/controllers/products.ts",
                    dependencies: ["Database Schema and Models"],
                    estimatedTime: "6 hours",
                    complexity: "medium" as const
                },
                {
                    title: "Shopping Cart Backend Logic",
                    description: "Implement cart persistence, item management, quantity updates, and session handling",
                    filePath: "server/controllers/cart.ts",
                    dependencies: ["Authentication System Backend"],
                    estimatedTime: "5 hours",
                    complexity: "medium" as const
                },
                {
                    title: "Frontend UI Components",
                    description: "Build reusable React components with TypeScript and Tailwind CSS for product cards, buttons, forms, and layout",
                    filePath: "src/components/ui/",
                    dependencies: ["Project Setup and Configuration"],
                    estimatedTime: "8 hours",
                    complexity: "medium" as const
                },
                {
                    title: "Product Catalog Frontend",
                    description: "Create product listing, filtering, search, and detail pages with responsive design",
                    filePath: "src/pages/Products.tsx",
                    dependencies: ["Frontend UI Components", "Product Management API"],
                    estimatedTime: "10 hours",
                    complexity: "high" as const
                },
                {
                    title: "Authentication Frontend",
                    description: "Implement login/register forms, protected routes, and user session management",
                    filePath: "src/components/auth/",
                    dependencies: ["Frontend UI Components", "Authentication System Backend"],
                    estimatedTime: "6 hours",
                    complexity: "medium" as const
                },
                {
                    title: "Shopping Cart Frontend",
                    description: "Build cart UI, item management, quantity controls, and checkout initiation",
                    filePath: "src/components/cart/",
                    dependencies: ["Frontend UI Components", "Shopping Cart Backend Logic"],
                    estimatedTime: "7 hours",
                    complexity: "medium" as const
                },
                {
                    title: "Payment Integration",
                    description: "Integrate Stripe payment processing with secure checkout flow and error handling",
                    filePath: "server/services/paymentService.ts",
                    dependencies: ["Shopping Cart Frontend"],
                    estimatedTime: "8 hours",
                    complexity: "high" as const
                }
            ],
            reasoning: "Tasks are organized in dependency order starting with foundational setup. Backend authentication and data models are prioritized to enable frontend development. UI components are built before specific features to ensure consistency. Payment integration comes last as it depends on all other systems being functional. Time estimates include testing and documentation."
        };

        // Create tasks.md file
        try {
            const tasksContent = this.formatTasksAsMarkdown(result);
            await this.workspaceEditService.applyEdits([{
                type: 'create',
                path: 'docs/tasks.md',
                content: tasksContent,
                options: { overwrite: true }
            }]);
            this.logService.info('✅ Created tasks.md file');
        } catch (error) {
            this.logService.error('❌ Failed to create tasks.md:', error);
        }

        return result;
    }

    async generateCode(tasks: IAITaskResult, selectedTasks?: string[], context?: string): Promise<IAICodeResult> {
        this.logService.info('🎭 MockAIProvider: Starting code generation...');
        
        await this.delay(2000);
        
        const tasksToImplement = selectedTasks 
            ? tasks.tasks.filter(task => selectedTasks.includes(task.title))
            : tasks.tasks.slice(0, 3); // Generate first 3 tasks for demo

        const files = await this.generateCodeFiles(tasksToImplement);
        
        this.logService.info(`🎭 MockAIProvider: Generated ${files.length} files`);
        
        // **THIS IS THE KEY PART** - Actually create the files using WorkspaceEditService
        try {
            const fileEdits = files.map(file => ({
                type: 'create' as const,
                path: file.path,
                content: file.content,
                options: { overwrite: true }
            }));

            this.logService.info('🎭 MockAIProvider: Creating files with WorkspaceEditService...');
            await this.workspaceEditService.applyEdits(fileEdits);
            this.logService.info('✅ MockAIProvider: Files created successfully!');
            
            // Validate the generated code for immediate feedback
            this.logService.info('🔍 MockAIProvider: Running code validation...');
            try {
                await this.codeValidationService.validateGeneratedFiles(files);
                this.logService.info('✅ MockAIProvider: Code validation completed');
            } catch (error) {
                this.logService.warn('⚠️ MockAIProvider: Code validation had issues:', error);
            }
        } catch (error) {
            this.logService.error('❌ MockAIProvider: Failed to create files:', error);
            throw error;
        }

        // Generate intelligent React components based on project memory
        await this.generateIntelligentComponents(files, tasksToImplement);

        return {
            files,
            reasoning: "Generated foundational files for the e-commerce platform using intelligent code generation. Files follow your project's conventions and include proper imports based on your existing codebase patterns. TypeScript best practices with proper error handling and type safety. The code is production-ready with comprehensive comments and documentation."
        };
    }

    private async generateCodeFiles(tasks: any[]): Promise<Array<{ path: string; content: string; description: string }>> {
        const files = [];
        this.logService.info('🧠 Using intelligent code generation...');

        // Always generate these core files
        files.push({
            path: "package.json", 
            description: "Project configuration and dependencies",
            content: `{
  "name": "ecommerce-platform",
  "version": "1.0.0",
  "description": "Modern e-commerce platform with React and Node.js",
  "main": "dist/server/index.js",
  "scripts": {
    "dev": "concurrently \\"npm run dev:server\\" \\"npm run dev:client\\"",
    "dev:server": "ts-node-dev --respawn --transpile-only server/index.ts",
    "dev:client": "vite",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "test": "jest",
    "test:e2e": "cypress run",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "^6.8.0",
    "react-query": "^3.39.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^6.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "stripe": "^12.0.0",
    "nodemailer": "^6.9.0",
    "redis": "^4.6.0",
    "zod": "^3.20.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/nodemailer": "^6.4.0",
    "typescript": "^5.0.0",
    "vite": "^4.0.0",
    "@vitejs/plugin-react": "^3.0.0",
    "tailwindcss": "^3.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "ts-node-dev": "^2.0.0",
    "concurrently": "^7.6.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "cypress": "^12.0.0"
  },
  "keywords": ["ecommerce", "react", "nodejs", "typescript"],
  "author": "Your Name",
  "license": "MIT"
}`
        });

        files.push({
            path: "prisma/schema.prisma",
            description: "Database schema with user, product, and order models",
            content: `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  firstName String
  lastName  String
  password  String
  role      UserRole @default(CUSTOMER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  orders    Order[]
  cartItems CartItem[]
  reviews   Review[]

  @@map("users")
}

model Product {
  id          String   @id @default(cuid())
  name        String
  description String?
  price       Decimal  @db.Decimal(10, 2)
  imageUrl    String?
  categoryId  String
  stock       Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  category    Category   @relation(fields: [categoryId], references: [id])
  cartItems   CartItem[]
  orderItems  OrderItem[]
  reviews     Review[]

  @@map("products")
}

model Category {
  id        String    @id @default(cuid())
  name      String    @unique
  slug      String    @unique
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // Relations
  products  Product[]

  @@map("categories")
}

model CartItem {
  id        String   @id @default(cuid())
  userId    String
  productId String
  quantity  Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId])
  @@map("cart_items")
}

model Order {
  id            String      @id @default(cuid())
  userId        String
  status        OrderStatus @default(PENDING)
  total         Decimal     @db.Decimal(10, 2)
  shippingAddress Json
  paymentIntentId String?   @unique
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  // Relations
  user          User        @relation(fields: [userId], references: [id])
  orderItems    OrderItem[]

  @@map("orders")
}

model OrderItem {
  id        String   @id @default(cuid())
  orderId   String
  productId String
  quantity  Int
  price     Decimal  @db.Decimal(10, 2)
  createdAt DateTime @default(now())

  // Relations
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id])

  @@map("order_items")
}

model Review {
  id        String   @id @default(cuid())
  userId    String
  productId String
  rating    Int      @db.SmallInt
  comment   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([userId, productId])
  @@map("reviews")
}

enum UserRole {
  CUSTOMER
  ADMIN
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}`
        });

        files.push({
            path: "server/controllers/auth.ts",
            description: "Authentication controller with JWT and bcrypt",
            content: `import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response) {
    try {
      // Validate request body
      const { email, firstName, lastName, password } = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'User with this email already exists'
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          password: hashedPassword
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true
        }
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        message: 'User registered successfully',
        user,
        token
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response) {
    try {
      // Validate request body
      const { email, password } = loginSchema.parse(req.body);

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        message: 'Login successful',
        user: userWithoutPassword,
        token
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      console.error('Login error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        user
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      const { firstName, lastName } = req.body;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName })
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          updatedAt: true
        }
      });

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }
}`
        });

        return files;
    }

    validateResponse(response: IAIResponse): boolean {
        return response.content.length > 0 && response.finishReason === 'stop';
    }

    estimateTokens(text: string): number {
        return Math.floor(text.length / 4);
    }

    isConfigured(): boolean {
        return true; // Mock provider is always "configured"
    }

    private generateMockContent(request: IAIRequest): string {
        const lastMessage = request.messages[request.messages.length - 1];
        return `Mock response for: ${lastMessage.content.substring(0, 100)}...`;
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private formatRequirementsAsMarkdown(requirements: IAIRequirementsResult): string {
        return `# Project Requirements

## Functional Requirements

${requirements.functional.map(req => `- ${req}`).join('\n')}

## Non-Functional Requirements

${requirements.nonFunctional.map(req => `- ${req}`).join('\n')}

## Constraints

${requirements.constraints.map(constraint => `- ${constraint}`).join('\n')}

## Assumptions

${requirements.assumptions.map(assumption => `- ${assumption}`).join('\n')}

## Reasoning

${requirements.reasoning}

---
*Generated by AI Companion on ${new Date().toISOString()}*
`;
    }

    private formatDesignAsMarkdown(design: IAIDesignResult): string {
        return `# Project Design

## Architecture

${design.architecture}

## Technology Stack

${design.techStack.map(tech => `- ${tech}`).join('\n')}

## Components

${design.components.map(component => `- ${component}`).join('\n')}

## Dependencies

${design.dependencies.map(dep => `- ${dep}`).join('\n')}

## Folder Structure

\`\`\`
${JSON.stringify(design.folderStructure, null, 2)}
\`\`\`

## Reasoning

${design.reasoning}

---
*Generated by AI Companion on ${new Date().toISOString()}*
`;
    }

    private formatTasksAsMarkdown(tasks: IAITaskResult): string {
        return `# Project Tasks

## Task List

${tasks.tasks.map((task, index) => `
### ${index + 1}. ${task.title}

- **Description**: ${task.description}
- **File Path**: ${task.filePath || 'N/A'}
- **Dependencies**: ${task.dependencies?.join(', ') || 'None'}
- **Estimated Time**: ${task.estimatedTime}
- **Complexity**: ${task.complexity}
`).join('\n')}

## Task Planning Reasoning

${tasks.reasoning}

---
*Generated by AI Companion on ${new Date().toISOString()}*
`;
    }

    private async generateIntelligentComponents(files: any[], tasks: any[]): Promise<void> {
        this.logService.info('🧠 Generating intelligent React components...');
        
        try {
            // Generate a sample React component using intelligent code generation
            const buttonComponent = await this.intelligentCodeGenerator.generateTemplate('react-component', {
                name: 'Button',
                description: 'Reusable button component with variants'
            });

            const buttonPath = this.intelligentCodeGenerator.suggestFilePath('Button.tsx', 'component');
            
            // Apply project conventions to the generated code
            const formattedButton = await this.intelligentCodeGenerator.applyConventions(buttonComponent, 'component');
            
            // Generate intelligent imports
            const imports = await this.intelligentCodeGenerator.generateImports(buttonPath, formattedButton);
            
            // Combine imports with component code
            const finalButtonCode = imports.length > 0 
                ? `${imports.join('\n')}\n\n${formattedButton}`
                : formattedButton;

            files.push({
                path: buttonPath,
                content: finalButtonCode,
                description: "Intelligent React Button component with project conventions applied"
            });
            
            this.logService.info('✅ Generated intelligent React component with project conventions');
            
            // Record successful generation for learning
            await this.feedbackLearningService.recordAcceptance('code', {
                fileName: buttonPath,
                fileType: 'component',
                framework: 'React',
                generatedContent: finalButtonCode,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            this.logService.error('❌ Failed to generate intelligent components:', error);
            
            // Record failure for learning
            await this.feedbackLearningService.recordRejection('code', {
                fileName: 'Button.tsx',
                fileType: 'component',
                framework: 'React',
                generatedContent: '',
                timestamp: new Date().toISOString()
            });
        }
    }
}
