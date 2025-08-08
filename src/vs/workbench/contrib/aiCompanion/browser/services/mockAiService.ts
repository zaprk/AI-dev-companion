// src/vs/workbench/contrib/aiCompanion/browser/services/mockAiService.ts

import { ICodeSearchService } from '../../common/codeSearchService.js';
import { IAINotificationService } from '../../common/aiNotificationService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

export interface MockAIResponse {
	content: string;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model: string;
	finishReason: string;
	sessionId: string;
	requestId: string;
}

export interface EnhancedMockAIResponse extends MockAIResponse {
	codebaseContext?: {
		relatedFiles: string[];
		patterns: string[];
		insights: string;
	};
}

export class MockAIService {
	private sessionId: string;
	private codeSearchService?: ICodeSearchService;
	private aiNotificationService?: IAINotificationService;
	private logService?: ILogService;

	constructor(
		sessionId: string = 'mock-session-123',
		codeSearchService?: ICodeSearchService,
		aiNotificationService?: IAINotificationService,
		logService?: ILogService
	) {
		this.sessionId = sessionId;
		this.codeSearchService = codeSearchService;
		this.aiNotificationService = aiNotificationService;
		this.logService = logService;
	}

	async generateMockResponse(type: string, prompt: string): Promise<EnhancedMockAIResponse> {
		// Show AI thinking notification
		const thinkingHandle = this.aiNotificationService?.showAIThinking();

		try {
			// Simulate network delay
			await this.delay(1500 + Math.random() * 1000);

			// Get codebase context if available
			let codebaseContext = undefined;
			if (this.codeSearchService) {
				codebaseContext = await this.getCodebaseContext(prompt, type);
			}

			const responses = {
				requirements: this.getRequirementsResponse(codebaseContext),
				design: this.getDesignResponse(codebaseContext),
				tasks: this.getTasksResponse(codebaseContext),
				code: this.getCodeResponse(codebaseContext),
				chat: this.getChatResponse(prompt, codebaseContext)
			};

			const content = responses[type as keyof typeof responses] || responses.chat;
			const tokenCount = Math.floor(content.length / 4); // Rough estimate

			// Close thinking notification and show completion
			thinkingHandle?.close();
			this.aiNotificationService?.showSuccess({
				title: 'AI Response Generated',
				message: `✅ Generated ${type} response with ${tokenCount} tokens`,
				autoClose: true
			});

			return {
				content,
				usage: {
					promptTokens: Math.floor(prompt.length / 4),
					completionTokens: tokenCount,
					totalTokens: Math.floor(prompt.length / 4) + tokenCount
				},
				model: 'gpt-4-mock',
				finishReason: 'stop',
				sessionId: this.sessionId,
				requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				codebaseContext
			};
		} catch (error) {
			thinkingHandle?.close();
			this.aiNotificationService?.showError({
				title: 'AI Response Failed',
				message: 'Failed to generate AI response',
				error: error as Error
			});
			throw error;
		}
	}

	// Simulate streaming response with enhanced context
	async *generateStreamingResponse(type: string, prompt: string): AsyncGenerator<string, void, unknown> {
		const fullResponse = await this.generateMockResponse(type, prompt);
		const content = fullResponse.content;
		
		// Stream the response word by word with realistic delays
		const words = content.split(' ');
		let accumulatedContent = '';
		
		for (let i = 0; i < words.length; i++) {
			const word = words[i] + (i < words.length - 1 ? ' ' : '');
			accumulatedContent += word;
			
			// Yield the new word
			yield word;
			
			// Variable delay based on content type
			const delay = type === 'code' ? 50 : 30; // Slower for code
			await this.delay(delay + Math.random() * 20);
		}
	}

	private async getCodebaseContext(prompt: string, type: string): Promise<any> {
		if (!this.codeSearchService) return null;

		try {
			const context: any = {
				relatedFiles: [],
				patterns: [],
				insights: ''
			};

			// Search for relevant code patterns based on the prompt and type
			const searchTerms = this.extractSearchTerms(prompt, type);
			
			for (const term of searchTerms) {
				try {
					const results = await this.codeSearchService.searchText(term, {
						maxResults: 5,
						includePattern: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx']
					});

					results.forEach(result => {
						context.relatedFiles.push(result.filePath);
						result.matches.forEach(match => {
							context.patterns.push(match.text);
						});
					});
				} catch (error) {
					this.logService?.warn(`Failed to search for term "${term}":`, error);
				}
			}

			// Get codebase analysis if this is a design or requirements request
			if (type === 'design' || type === 'requirements') {
				try {
					const analysis = await this.codeSearchService.analyzeCodebase();
					context.insights = `Codebase has ${analysis.totalFiles} files, ${Object.keys(analysis.languages).length} languages, and ${analysis.frameworks.join(', ') || 'no frameworks'} detected`;
				} catch (error) {
					this.logService?.warn('Failed to analyze codebase:', error);
				}
			}

			return context;
		} catch (error) {
			this.logService?.error('Failed to get codebase context:', error);
			return null;
		}
	}

	private extractSearchTerms(prompt: string, type: string): string[] {
		const terms: string[] = [];
		const lowerPrompt = prompt.toLowerCase();

		// Extract technology-related terms
		const techTerms = ['react', 'typescript', 'javascript', 'node', 'express', 'prisma', 'postgresql', 'mongodb', 'redis', 'docker', 'aws', 'stripe', 'material-ui', 'mui', 'redux', 'next', 'vue', 'angular'];
		techTerms.forEach(term => {
			if (lowerPrompt.includes(term)) {
				terms.push(term);
			}
		});

		// Extract pattern-related terms
		const patternTerms = ['function', 'class', 'interface', 'component', 'hook', 'service', 'controller', 'model', 'api', 'route', 'middleware'];
		patternTerms.forEach(term => {
			if (lowerPrompt.includes(term)) {
				terms.push(term);
			}
		});

		// Add type-specific terms
		if (type === 'code') {
			terms.push('import', 'export', 'const', 'let', 'var');
		} else if (type === 'design') {
			terms.push('architecture', 'structure', 'component', 'service');
		} else if (type === 'requirements') {
			terms.push('requirement', 'feature', 'functionality');
		}

		return terms.slice(0, 5); // Limit to 5 terms
	}

	private getRequirementsResponse(codebaseContext?: any): string {
		let contextInfo = '';
		if (codebaseContext?.insights) {
			contextInfo = `\n\n**Codebase Context:** ${codebaseContext.insights}`;
		}

		return JSON.stringify({
			functional: [
				"User registration and authentication system with email verification",
				"Product catalog with categories, search, and filtering capabilities",
				"Shopping cart functionality with add/remove/update quantities",
				"Secure checkout process with multiple payment options (Stripe, PayPal)",
				"Order management system with order tracking and history",
				"Admin dashboard for product management and inventory control",
				"User profile management with order history and saved addresses",
				"Product reviews and ratings system",
				"Wishlist functionality for saving favorite products",
				"Email notifications for order confirmations and shipping updates",
				"Inventory management with low stock alerts",
				"Discount and coupon code system",
				"Multi-currency support for international customers",
				"Mobile-responsive design for all devices"
			],
			nonFunctional: [
				"Page load times under 3 seconds for optimal user experience",
				"Support for 10,000+ concurrent users during peak traffic",
				"99.9% uptime with robust error handling and recovery",
				"SSL encryption for all sensitive data transmission",
				"PCI DSS compliance for secure payment processing",
				"SEO-optimized URLs and metadata for search engine visibility",
				"Accessibility compliance (WCAG 2.1 AA standards)",
				"Cross-browser compatibility (Chrome, Firefox, Safari, Edge)",
				"Database backup and disaster recovery procedures",
				"GDPR compliance for European customer data protection"
			],
			constraints: [
				"Must integrate with existing Stripe payment infrastructure",
				"Budget limit of $50,000 for initial development phase",
				"Development timeline of 4-6 months to market launch",
				"Must use React.js and Node.js technology stack",
				"Integration required with existing inventory management system",
				"Compliance with local tax calculation requirements",
				"Must support both B2C and B2B customer types",
				"Integration with existing customer support ticketing system"
			],
			assumptions: [
				"Customer base will primarily be English-speaking initially",
				"Primary traffic will come from desktop users (60%) and mobile (40%)",
				"Product catalog will contain 1,000-5,000 items at launch",
				"Average order value expected to be $75-150",
				"Customer support will be handled through existing channels",
				"Marketing campaigns will drive initial user acquisition",
				"Return/refund policy will follow standard e-commerce practices",
				"Initial launch will target domestic market before international expansion"
			],
			reasoning: `This e-commerce platform is designed as a comprehensive solution that balances user experience with business requirements. The functional requirements cover all essential e-commerce features from browsing to checkout, while non-functional requirements ensure scalability and security. The constraints reflect realistic business limitations, and assumptions help guide development priorities. The platform is structured to support both immediate launch needs and future growth opportunities.${contextInfo}`
		}, null, 2);
	}

	private getDesignResponse(codebaseContext?: any): string {
		let contextInfo = '';
		if (codebaseContext?.insights) {
			contextInfo = `\n\n**Codebase Context:** ${codebaseContext.insights}`;
		}

		// Adjust tech stack based on codebase context
		let techStack = [
			"Frontend: React 18, TypeScript, Redux Toolkit, Material-UI",
			"Backend: Node.js, Express.js, TypeScript, JWT authentication",
			"Database: PostgreSQL with Prisma ORM",
			"Caching: Redis for session and product caching",
			"Payment: Stripe API integration",
			"File Storage: AWS S3 for product images",
			"Email: SendGrid for transactional emails",
			"Testing: Jest, React Testing Library, Supertest",
			"Deployment: Docker containers on AWS ECS",
			"CI/CD: GitHub Actions with automated testing"
		];

		// If we found specific patterns in the codebase, adjust recommendations
		if (codebaseContext?.patterns) {
			if (codebaseContext.patterns.some((p: string) => p.includes('Next.js'))) {
				techStack = techStack.map(tech => 
					tech.includes('React 18') ? 'Frontend: Next.js 13, TypeScript, Redux Toolkit, Material-UI' : tech
				);
			}
			if (codebaseContext.patterns.some((p: string) => p.includes('MongoDB'))) {
				techStack = techStack.map(tech => 
					tech.includes('PostgreSQL') ? 'Database: MongoDB with Mongoose ODM' : tech
				);
			}
		}

		return JSON.stringify({
			folderStructure: {
				"frontend/": {
					"src/": {
						"components/": {
							"common/": {},
							"auth/": {},
							"products/": {},
							"cart/": {},
							"checkout/": {},
							"admin/": {}
						},
						"pages/": {
							"Home/": {},
							"ProductList/": {},
							"ProductDetail/": {},
							"Cart/": {},
							"Checkout/": {},
							"Profile/": {},
							"Admin/": {}
						},
						"hooks/": {},
						"services/": {},
						"utils/": {},
						"styles/": {},
						"store/": {
							"slices/": {}
						}
					},
					"public/": {}
				},
				"backend/": {
					"src/": {
						"controllers/": {},
						"models/": {},
						"routes/": {},
						"middleware/": {},
						"services/": {},
						"utils/": {},
						"config/": {}
					},
					"tests/": {}
				},
				"shared/": {
					"types/": {},
					"constants/": {}
				}
			},
			components: [
				"Header with navigation and user menu",
				"ProductGrid for displaying product listings",
				"ProductCard for individual product display",
				"SearchBar with autocomplete functionality",
				"CategoryFilter for product filtering",
				"ShoppingCart with item management",
				"CheckoutForm with payment integration",
				"UserProfile for account management",
				"AdminDashboard for backend management",
				"OrderHistory for tracking purchases",
				"ProductReviews for customer feedback",
				"Footer with company information and links"
			],
			architecture: "Modern full-stack architecture using React.js frontend with Redux for state management, Node.js/Express backend with RESTful APIs, PostgreSQL database with Redis caching, and microservices for payment processing and inventory management. The system follows MVC pattern with clear separation of concerns.",
			techStack: techStack,
			dependencies: [
				"react: ^18.2.0",
				"redux-toolkit: ^1.9.0",
				"@mui/material: ^5.11.0",
				"axios: ^1.3.0",
				"react-router-dom: ^6.8.0",
				"express: ^4.18.0",
				"prisma: ^4.11.0",
				"bcrypt: ^5.1.0",
				"jsonwebtoken: ^9.0.0",
				"stripe: ^11.16.0",
				"nodemailer: ^6.9.0",
				"redis: ^4.6.0",
				"dotenv: ^16.0.0",
				"cors: ^2.8.5",
				"helmet: ^6.0.0"
			],
			reasoning: `The architecture emphasizes scalability, maintainability, and developer experience. React with TypeScript provides type safety and component reusability, while Redux manages complex state across the application. The Node.js backend offers excellent performance and npm ecosystem access. PostgreSQL ensures data integrity with ACID compliance, while Redis provides fast caching. The microservices approach allows independent scaling of critical components like payments and inventory.${contextInfo}`
		}, null, 2);
	}

	private getTasksResponse(codebaseContext?: any): string {
		let contextInfo = '';
		if (codebaseContext?.insights) {
			contextInfo = `\n\n**Codebase Context:** ${codebaseContext.insights}`;
		}

		return JSON.stringify({
			tasks: [
				{
					title: "Project Setup and Configuration",
					description: "Initialize React and Node.js projects with TypeScript, ESLint, and Prettier configuration. Set up development environment with hot reload and debugging.",
					filePath: "package.json",
					dependencies: [],
					estimatedTime: "4 hours",
					complexity: "low"
				},
				{
					title: "Database Schema Design and Setup",
					description: "Create PostgreSQL database schema with Prisma ORM. Define models for Users, Products, Orders, Categories, and Reviews with proper relationships.",
					filePath: "backend/prisma/schema.prisma",
					dependencies: ["Project Setup and Configuration"],
					estimatedTime: "6 hours",
					complexity: "medium"
				},
				{
					title: "Authentication System Implementation",
					description: "Build JWT-based authentication with registration, login, password reset, and email verification functionality.",
					filePath: "backend/src/controllers/authController.ts",
					dependencies: ["Database Schema Design and Setup"],
					estimatedTime: "8 hours",
					complexity: "medium"
				},
				{
					title: "Product Management API",
					description: "Create RESTful APIs for product CRUD operations, category management, and search functionality with pagination.",
					filePath: "backend/src/controllers/productController.ts",
					dependencies: ["Database Schema Design and Setup", "Authentication System Implementation"],
					estimatedTime: "10 hours",
					complexity: "medium"
				},
				{
					title: "Frontend Component Library",
					description: "Build reusable React components including ProductCard, ProductGrid, SearchBar, and common UI elements using Material-UI.",
					filePath: "frontend/src/components/",
					dependencies: ["Project Setup and Configuration"],
					estimatedTime: "12 hours",
					complexity: "medium"
				},
				{
					title: "Product Catalog Frontend",
					description: "Implement product listing, search, filtering, and product detail pages with responsive design and optimal performance.",
					filePath: "frontend/src/pages/ProductList/",
					dependencies: ["Frontend Component Library", "Product Management API"],
					estimatedTime: "14 hours",
					complexity: "high"
				},
				{
					title: "Shopping Cart Implementation",
					description: "Build shopping cart functionality with Redux state management, local storage persistence, and quantity management.",
					filePath: "frontend/src/store/slices/cartSlice.ts",
					dependencies: ["Frontend Component Library"],
					estimatedTime: "8 hours",
					complexity: "medium"
				},
				{
					title: "Payment Integration with Stripe",
					description: "Integrate Stripe payment processing with secure checkout flow, payment confirmation, and error handling.",
					filePath: "backend/src/services/paymentService.ts",
					dependencies: ["Shopping Cart Implementation", "Authentication System Implementation"],
					estimatedTime: "12 hours",
					complexity: "high"
				},
				{
					title: "Order Management System",
					description: "Build order processing, order history, and order tracking functionality for both customers and administrators.",
					filePath: "backend/src/controllers/orderController.ts",
					dependencies: ["Payment Integration with Stripe"],
					estimatedTime: "10 hours",
					complexity: "high"
				},
				{
					title: "Admin Dashboard",
					description: "Create comprehensive admin interface for product management, order processing, and analytics with role-based access control.",
					filePath: "frontend/src/pages/Admin/",
					dependencies: ["Order Management System", "Product Management API"],
					estimatedTime: "16 hours",
					complexity: "high"
				},
				{
					title: "Testing and Quality Assurance",
					description: "Implement comprehensive test suite including unit tests, integration tests, and end-to-end testing with automated CI/CD pipeline.",
					filePath: "tests/",
					dependencies: ["Admin Dashboard"],
					estimatedTime: "20 hours",
					complexity: "high"
				},
				{
					title: "Deployment and Production Setup",
					description: "Configure production deployment with Docker, AWS services, environment variables, and monitoring systems.",
					filePath: "docker-compose.yml",
					dependencies: ["Testing and Quality Assurance"],
					estimatedTime: "8 hours",
					complexity: "medium"
				}
			],
			reasoning: `The task breakdown follows a logical development sequence, starting with foundational setup and moving through backend APIs, frontend components, and finally integration and deployment. Each task has clear dependencies and realistic time estimates. The complexity ratings help prioritize developer assignment and planning. Critical path items like authentication and payment processing are properly sequenced to avoid blocking dependencies.${contextInfo}`
		}, null, 2);
	}

	private getCodeResponse(codebaseContext?: any): string {
		let contextInfo = '';
		if (codebaseContext?.insights) {
			contextInfo = `\n\n**Codebase Context:** ${codebaseContext.insights}`;
		}

		// Adjust code generation based on codebase context
		let codeFiles = this.getDefaultCodeFiles();
		
		if (codebaseContext?.patterns) {
			// If we found existing patterns, adapt the code to match
			if (codebaseContext.patterns.some((p: string) => p.includes('Next.js'))) {
				codeFiles = this.getNextJsCodeFiles();
			} else if (codebaseContext.patterns.some((p: string) => p.includes('MongoDB'))) {
				codeFiles = this.getMongoDBCodeFiles();
			}
		}

		return JSON.stringify({
			files: codeFiles,
			reasoning: `The generated code provides a solid foundation for the e-commerce platform with modern best practices. The React components use TypeScript and Material-UI for type safety and consistent styling. The backend implements clean architecture with proper separation of concerns, validation, and error handling. The Prisma model provides robust database operations with proper relationships and indexing. All code is production-ready with proper error handling, validation, and TypeScript support.${contextInfo}`
		}, null, 2);
	}

	private getDefaultCodeFiles(): any[] {
		return [
			{
				path: "package.json",
				content: `{
  "name": "ecommerce-platform",
  "version": "1.0.0",
  "description": "Modern e-commerce platform built with React and Node.js",
  "main": "index.js",
  "scripts": {
    "dev": "concurrently \\"npm run dev:frontend\\" \\"npm run dev:backend\\"",
    "dev:frontend": "cd frontend && npm start",
    "dev:backend": "cd backend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "test": "npm run test:frontend && npm run test:backend",
    "test:frontend": "cd frontend && npm test",
    "test:backend": "cd backend && npm test"
  },
  "workspaces": [
    "frontend",
    "backend",
    "shared"
  ],
  "devDependencies": {
    "concurrently": "^7.6.0"
  },
  "keywords": ["ecommerce", "react", "nodejs", "typescript"],
  "author": "Your Name",
  "license": "MIT"
}`,
				description: "Root package.json with workspace configuration and scripts for managing the monorepo structure"
			},
			{
				path: "frontend/src/components/products/ProductCard.tsx",
				content: `import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Box,
  Rating,
  Chip
} from '@mui/material';
import { ShoppingCart, Favorite } from '@mui/icons-material';
import { Product } from '../../types/Product';
import { useAppDispatch } from '../../hooks/redux';
import { addToCart } from '../../store/slices/cartSlice';

interface ProductCardProps {
  product: Product;
  onAddToWishlist?: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToWishlist 
}) => {
  const dispatch = useAppDispatch();

  const handleAddToCart = () => {
    dispatch(addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1
    }));
  };

  const handleAddToWishlist = () => {
    if (onAddToWishlist) {
      onAddToWishlist(product.id);
    }
  };

  return (
    <Card 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3
        }
      }}
    >
      <CardMedia
        component="img"
        height="200"
        image={product.image}
        alt={product.name}
        sx={{ objectFit: 'cover' }}
      />
      
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" component="h3" gutterBottom noWrap>
          {product.name}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>
          {product.description}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Rating value={product.rating} readOnly size="small" />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            ({product.reviewCount})
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" color="primary" fontWeight="bold">
            \${product.price.toFixed(2)}
          </Typography>
          {product.originalPrice && product.originalPrice > product.price && (
            <Typography 
              variant="body2" 
              sx={{ textDecoration: 'line-through', color: 'text.secondary' }}
            >
              \${product.originalPrice.toFixed(2)}
            </Typography>
          )}
        </Box>
        
        {product.stock < 10 && product.stock > 0 && (
          <Chip 
            label={\`Only \${product.stock} left!\`}
            color="warning" 
            size="small" 
            sx={{ mb: 2 }}
          />
        )}
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<ShoppingCart />}
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            fullWidth
          >
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleAddToWishlist}
            sx={{ minWidth: 'auto', px: 2 }}
          >
            <Favorite />
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};`,
				description: "Product card component with Material-UI styling, add to cart functionality, and wishlist support"
			}
		];
	}

	private getNextJsCodeFiles(): any[] {
		return [
			{
				path: "package.json",
				content: `{
  "name": "ecommerce-platform",
  "version": "1.0.0",
  "description": "Modern e-commerce platform built with Next.js",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  },
  "dependencies": {
    "next": "^13.4.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@mui/material": "^5.11.0",
    "@emotion/react": "^11.10.0",
    "@emotion/styled": "^11.10.0",
    "@reduxjs/toolkit": "^1.9.0",
    "react-redux": "^8.0.0",
    "axios": "^1.3.0",
    "prisma": "^4.11.0",
    "@prisma/client": "^4.11.0"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^13.4.0",
    "jest": "^29.0.0"
  }
}`,
				description: "Next.js package.json with modern dependencies and TypeScript support"
			}
		];
	}

	private getMongoDBCodeFiles(): any[] {
		return [
			{
				path: "backend/src/models/Product.ts",
				content: `import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  categoryId: mongoose.Types.ObjectId;
  stock: number;
  images: string[];
  tags: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  slug: string;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  images: [{
    type: String,
    required: true
  }],
  tags: [{
    type: String
  }],
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 }
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ stock: 1 });
ProductSchema.index({ slug: 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);`,
				description: "MongoDB Product model with Mongoose schema, indexes, and TypeScript interfaces"
			}
		];
	}

	private getChatResponse(prompt: string, codebaseContext?: any): string {
		const responses = [
			"I'd be happy to help you build an e-commerce platform! This is an exciting project that involves many moving parts. Would you like me to start by generating the requirements, or do you have specific questions about the implementation?",
			"An e-commerce platform is a great choice for a comprehensive web application. I can help you with everything from the initial requirements gathering to the final code implementation. What specific aspects are you most interested in?",
			"Building an e-commerce platform involves several key components: user authentication, product management, shopping cart functionality, payment processing, and order management. I can guide you through each step of the development process.",
			"That's a fantastic project! E-commerce platforms require careful planning around user experience, security, and scalability. Would you like me to walk you through the complete development workflow from requirements to deployment?"
		];

		const lowerPrompt = prompt.toLowerCase();
		
		// Add context-aware responses
		if (codebaseContext?.insights) {
			responses.push(`I can see your codebase has ${codebaseContext.insights}. This gives us a great foundation to build upon! What specific features would you like to add or improve?`);
		}
		
		if (codebaseContext?.relatedFiles.length > 0) {
			responses.push(`I found some relevant files in your codebase that might be helpful for this project. Would you like me to analyze them and provide specific recommendations based on your existing code structure?`);
		}
		
		if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('e-commerce') || lowerPrompt.includes('shopping')) {
			return responses[Math.floor(Math.random() * responses.length)];
		}
		
		return "I understand you want to build something interesting! Could you provide more details about what you'd like to create? I can help with requirements, design, implementation, and more.";
	}

	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// Method to create mock streaming chunks for realistic streaming simulation
	createStreamingChunks(content: string): string[] {
		// Parse JSON content if it's structured
		let textContent = content;
		try {
			const parsed = JSON.parse(content);
			// Convert structured content to readable format for streaming
			if (parsed.functional) {
				textContent = this.formatRequirementsForStreaming(parsed);
			} else if (parsed.folderStructure) {
				textContent = this.formatDesignForStreaming(parsed);
			} else if (parsed.tasks) {
				textContent = this.formatTasksForStreaming(parsed);
			} else if (parsed.files) {
				textContent = this.formatCodeForStreaming(parsed);
			}
		} catch (e) {
			// Content is already text, use as-is
		}

		// Split into realistic chunks
		const sentences = textContent.match(/[^\.!?]+[\.!?]+/g) || [textContent];
		return sentences.map(sentence => sentence.trim()).filter(s => s.length > 0);
	}

	private formatRequirementsForStreaming(req: any): string {
		let content = '🧠 **E-commerce Platform Requirements**\n\n';
		
		content += '## 🎯 Functional Requirements\n';
		req.functional.forEach((item: string, i: number) => {
			content += `${i + 1}. ${item}\n`;
		});
		content += '\n';
		
		content += '## ⚡ Non-Functional Requirements\n';
		req.nonFunctional.forEach((item: string, i: number) => {
			content += `${i + 1}. ${item}\n`;
		});
		content += '\n';
		
		content += '## 🚧 Constraints\n';
		req.constraints.forEach((item: string, i: number) => {
			content += `${i + 1}. ${item}\n`;
		});
		content += '\n';
		
		content += '## 💭 Assumptions\n';
		req.assumptions.forEach((item: string, i: number) => {
			content += `${i + 1}. ${item}\n`;
		});
		content += '\n';
		
		content += `## 🤔 Analysis\n${req.reasoning}`;
		
		return content;
	}

	private formatDesignForStreaming(design: any): string {
		let content = '🏗️ **E-commerce Platform System Design**\n\n';
		
		content += `## 🏛️ Architecture\n${design.architecture}\n\n`;
		
		content += `## 🛠️ Technology Stack\n`;
		design.techStack.forEach((tech: string, i: number) => {
			content += `${i + 1}. ${tech}\n`;
		});
		content += '\n';
		
		content += '## 📦 Key Components\n';
		design.components.forEach((comp: string, i: number) => {
			content += `${i + 1}. ${comp}\n`;
		});
		content += '\n';
		
		content += '## 📚 Dependencies\n';
		design.dependencies.forEach((dep: string, i: number) => {
			content += `${i + 1}. ${dep}\n`;
		});
		content += '\n';
		
		content += '## 📁 Project Structure\n```\n';
		content += this.formatFolderStructure(design.folderStructure, 0);
		content += '```\n\n';
		
		content += `## 🤔 Design Rationale\n${design.reasoning}`;
		
		return content;
	}

	private formatTasksForStreaming(tasks: any): string {
		let content = '📋 **Implementation Roadmap**\n\n';
		
		tasks.tasks.forEach((task: any, i: number) => {
			content += `## ${i + 1}. ${task.title}\n`;
			content += `**Description:** ${task.description}\n\n`;
			if (task.filePath) {
				content += `**File:** \`${task.filePath}\`\n`;
			}
			if (task.dependencies && task.dependencies.length > 0) {
				content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
			}
			content += `**Time Estimate:** ${task.estimatedTime}\n`;
			content += `**Complexity:** ${task.complexity.toUpperCase()}\n\n`;
		});
		
		content += `## 📊 Project Strategy\n${tasks.reasoning}`;
		
		return content;
	}

	private formatCodeForStreaming(code: any): string {
		let content = '💻 **Generated Code Files**\n\n';
		
		code.files.forEach((file: any, i: number) => {
			content += `## ${i + 1}. ${file.path}\n`;
			content += `${file.description}\n\n`;
			
			// Show first 15 lines of code
			const lines = file.content.split('\n').slice(0, 15);
			const fileExt = file.path.split('.').pop();
			const language = this.getLanguageFromExtension(fileExt);
			
			content += `\`\`\`${language}\n${lines.join('\n')}`;
			if (file.content.split('\n').length > 15) {
				content += '\n// ... (continued)';
			}
			content += '\n```\n\n';
		});
		
		content += `## 🎯 Implementation Notes\n${code.reasoning}`;
		
		return content;
	}

	private formatFolderStructure(structure: any, depth: number = 0): string {
		let result = '';
		const indent = '  '.repeat(depth);
		
		for (const [name, children] of Object.entries(structure)) {
			result += `${indent}${name}\n`;
			if (children && typeof children === 'object') {
				result += this.formatFolderStructure(children, depth + 1);
			}
		}
		
		return result;
	}

	private getLanguageFromExtension(ext: string): string {
		const languageMap: { [key: string]: string } = {
			'ts': 'typescript',
			'tsx': 'typescript',
			'js': 'javascript',
			'jsx': 'javascript',
			'json': 'json',
			'py': 'python',
			'java': 'java',
			'cs': 'csharp',
			'cpp': 'cpp',
			'c': 'c',
			'go': 'go',
			'rs': 'rust',
			'php': 'php',
			'rb': 'ruby',
			'swift': 'swift',
			'kt': 'kotlin',
			'sql': 'sql',
			'html': 'html',
			'css': 'css',
			'scss': 'scss',
			'yaml': 'yaml',
			'yml': 'yaml',
			'xml': 'xml',
			'md': 'markdown'
		};
		
		return languageMap[ext] || 'text';
	}
}