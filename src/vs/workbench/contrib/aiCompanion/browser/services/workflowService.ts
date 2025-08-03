export type WorkflowType = 'requirements' | 'design' | 'tasks' | 'code' | 'chat';

export class WorkflowDetectionService {
	detectWorkflowType(content: string): WorkflowType {
		const lowerContent = content.toLowerCase();

		if (/\b(build|create|make|develop|implement|want to build)\b/.test(lowerContent)) {
			return 'requirements';
		}
		if (/\b(design|architecture|structure|tech stack)\b/.test(lowerContent)) {
			return 'design';
		}
		if (/\b(tasks|todo|steps|breakdown|plan)\b/.test(lowerContent)) {
			return 'tasks';
		}
		if (/\b(generate code|write code|implement|code for)\b/.test(lowerContent)) {
			return 'code';
		}
		
		return 'chat';
	}

	getFallbackContent(workflowType: WorkflowType, content: string): string {
		switch (workflowType) {
			case 'requirements':
				return `🧠 **E-commerce Website Requirements**

## 1. Project Overview
- **Goal**: Create a simple e-commerce website for online shopping
- **Business Objectives**: Sell products online, manage inventory, process orders
- **Success Criteria**: Functional shopping cart, secure checkout, responsive design

## 2. Functional Requirements

### 2.1 User Stories
**As a customer, I want to:**
- Browse products by category
- Search for specific items
- Add items to shopping cart
- Complete secure checkout
- Track my order status

**As an admin, I want to:**
- Manage product inventory
- Process orders
- View sales reports
- Update product information

### 2.2 Acceptance Criteria
- Product catalog with images and descriptions
- Shopping cart functionality
- Secure payment processing
- Order confirmation emails
- Admin dashboard for management

## 3. Non-Functional Requirements
- **Performance**: Page load < 3 seconds
- **Security**: SSL encryption, secure payment
- **Scalability**: Support 1000+ concurrent users
- **Usability**: Mobile-responsive design

## 4. Technical Specifications
- **Frontend**: React.js with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Payment**: Stripe integration
- **Hosting**: Vercel/Netlify

## 5. Key Features
- Product catalog and search
- Shopping cart and checkout
- User authentication
- Order management
- Admin dashboard

Would you like me to proceed with the design phase?`;

			case 'design':
				return `🏗️ **E-commerce Website Design**

## Architecture Overview
- **Frontend**: React SPA with TypeScript
- **Backend**: Node.js REST API
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens
- **Payment**: Stripe integration

## Database Schema
\`\`\`sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL,
  category_id INTEGER REFERENCES categories(id)
);

-- Orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

## API Endpoints
- \`GET /api/products\` - List products
- \`POST /api/cart/add\` - Add to cart
- \`POST /api/orders\` - Create order
- \`GET /api/orders/:id\` - Get order status

## Frontend Components
- ProductGrid, ProductCard
- ShoppingCart, CartItem
- CheckoutForm
- UserDashboard, AdminPanel

Ready to generate implementation tasks?`;

			case 'tasks':
				return `📋 **Implementation Tasks**

## Phase 1: Project Setup
1. **Initialize React project**
   - Create React app with TypeScript
   - Set up routing with React Router
   - Configure ESLint and Prettier

2. **Backend setup**
   - Initialize Node.js project
   - Set up Express server
   - Configure PostgreSQL database
   - Set up Prisma ORM

## Phase 2: Core Features
3. **Database implementation**
   - Create database schema
   - Set up Prisma models
   - Create database migrations

4. **Authentication system**
   - Implement user registration/login
   - Set up JWT token handling
   - Create protected routes

5. **Product management**
   - Create product CRUD operations
   - Implement product search/filtering
   - Add product images handling

## Phase 3: Shopping Features
6. **Shopping cart**
   - Implement cart state management
   - Add/remove items functionality
   - Cart persistence

7. **Checkout process**
   - Create checkout form
   - Integrate Stripe payment
   - Order confirmation

## Phase 4: Admin Features
8. **Admin dashboard**
   - Order management interface
   - Product inventory management
   - Sales reporting

Ready to generate code files?`;

			case 'code':
				return `💻 **Generated Code Structure**

## Frontend Files
\`\`\`typescript
// src/components/ProductGrid.tsx
export const ProductGrid = () => {
  // Product listing component
};

// src/components/ShoppingCart.tsx
export const ShoppingCart = () => {
  // Cart management component
};

// src/pages/Checkout.tsx
export const Checkout = () => {
  // Checkout form component
};
\`\`\`

## Backend Files
\`\`\`typescript
// src/routes/products.ts
router.get('/products', getProducts);
router.post('/products', createProduct);

// src/routes/orders.ts
router.post('/orders', createOrder);
router.get('/orders/:id', getOrder);

// src/services/stripe.ts
export const createPaymentIntent = async (amount: number) => {
  // Stripe integration
};
\`\`\`

## Database Schema
\`\`\`sql
-- Complete database schema
CREATE TABLE users (...);
CREATE TABLE products (...);
CREATE TABLE orders (...);
CREATE TABLE order_items (...);
\`\`\`

🎉 **E-commerce website structure ready!**

The code files have been generated. You can now start implementing your e-commerce website with these components and structure.`;

			default:
				return `✅ **${workflowType} Generated Successfully**

The ${workflowType} has been created for your e-commerce website project. You can now proceed with the next phase of development.`;
		}
	}
}

// Formatting service for different workflow types
export class WorkflowFormattingService {
	formatWorkflowResponse(content: any, workflowType: WorkflowType): string {
		console.log(`🎨 Formatting ${workflowType} response:`, {
			contentType: typeof content,
			isString: typeof content === 'string',
			length: content?.length,
			startsWithBrace: typeof content === 'string' && content.trim().startsWith('{')
		});
		
		try {
			// If content is already an object, use it directly
			if (typeof content === 'object' && content !== null) {
				console.log('📦 Content is already an object');
				return this.formatStructuredContent(content, workflowType);
			}
			
			// If content is a string, try to parse it as JSON
			if (typeof content === 'string') {
				console.log('📝 Content is a string, attempting JSON parse...');
				
				// Clean the content first
				const cleanContent = content.trim();
				
				if (cleanContent.startsWith('{') || cleanContent.startsWith('[')) {
					try {
						const parsed = JSON.parse(cleanContent);
						console.log('✅ Successfully parsed JSON:', typeof parsed);
						return this.formatStructuredContent(parsed, workflowType);
					} catch (parseError) {
						console.warn('⚠️ JSON parse failed:', parseError);
						// Fallback to plain text formatting
						return this.formatPlainContent(cleanContent, workflowType);
					}
				} else {
					console.log('📄 Content is plain text');
					return this.formatPlainContent(cleanContent, workflowType);
				}
			}
			
			console.warn('⚠️ Unexpected content type:', typeof content);
			return String(content);
			
		} catch (error) {
			console.error('❌ Error formatting workflow response:', error);
			return `Error formatting response: ${String(content)}`;
		}
	}

	formatStreamingContent(content: string, workflowType: WorkflowType, isFinal: boolean = false): string {
		const prefix = `🧠 **Generated ${workflowType}**${isFinal ? '' : ' (streaming...)'}\n\n`;
		
		if (isFinal && workflowType !== 'chat') {
			try {
				const cleanContent = content.trim();
				
				if (cleanContent.startsWith('{') && cleanContent.endsWith('}')) {
					const parsed = JSON.parse(cleanContent);
					const formatted = this.formatWorkflowResponse(parsed, workflowType);
					return `${prefix}${formatted}`;
				}
			} catch (parseError) {
				console.log('Final content is not parseable JSON, using as-is');
			}
		}
		
		return `${prefix}${content}${isFinal ? '' : '▋'}`;
	}

	private formatStructuredContent(parsed: any, workflowType: WorkflowType): string {
		console.log(`🏗️ Formatting structured content for ${workflowType}`);
		
		switch (workflowType) {
			case 'requirements':
				return this.formatRequirementsStructured(parsed);
			case 'design':
				return this.formatDesignStructured(parsed);
			case 'tasks':
				return this.formatTasksStructured(parsed);
			case 'code':
				return this.formatCodeStructured(parsed);
			default:
				return JSON.stringify(parsed, null, 2);
		}
	}

	private formatPlainContent(content: string, workflowType: WorkflowType): string {
		console.log(`📄 Formatting plain content for ${workflowType}`);
		
		// If content is not structured JSON, format it nicely
		return content
			.replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting for now
			.replace(/\*(.*?)\*/g, '$1')     // Remove italic formatting
			.trim();
	}

	private formatRequirementsStructured(req: any): string {
		console.log('📋 Formatting requirements:', req);
		let content = '';
		
		if (req.functional?.length) {
			content += '## 🎯 Functional Requirements\n';
			req.functional.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.nonFunctional?.length) {
			content += '## ⚡ Non-Functional Requirements\n';
			req.nonFunctional.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.constraints?.length) {
			content += '## 🚧 Constraints\n';
			req.constraints.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.assumptions?.length) {
			content += '## 💭 Assumptions\n';
			req.assumptions.forEach((item: string, i: number) => {
				content += `${i + 1}. ${item}\n`;
			});
			content += '\n';
		}
		
		if (req.reasoning) {
			content += `## 🤔 Reasoning\n${req.reasoning}\n`;
		}
		
		return content || 'No structured requirements found';
	}

	private formatDesignStructured(design: any): string {
		console.log('🏗️ Formatting design:', design);
		let content = '';
		
		if (design.architecture) {
			content += `## 🏛️ Architecture\n${design.architecture}\n\n`;
		}
		
		if (design.techStack?.length) {
			content += `## 🛠️ Tech Stack\n${design.techStack.join(', ')}\n\n`;
		}
		
		if (design.components?.length) {
			content += '## 📦 Components\n';
			design.components.forEach((comp: string, i: number) => {
				content += `${i + 1}. ${comp}\n`;
			});
			content += '\n';
		}
		
		if (design.dependencies?.length) {
			content += '## 📚 Dependencies\n';
			design.dependencies.forEach((dep: string, i: number) => {
				content += `${i + 1}. ${dep}\n`;
			});
			content += '\n';
		}
		
		if (design.folderStructure) {
			content += '## 📁 Folder Structure\n```\n';
			content += this.formatFolderStructure(design.folderStructure, 0);
			content += '```\n\n';
		}
		
		if (design.reasoning) {
			content += `## 🤔 Reasoning\n${design.reasoning}\n`;
		}
		
		return content || 'No structured design found';
	}

	private formatTasksStructured(tasks: any): string {
		console.log('📝 Formatting tasks:', tasks);
		let content = '';
		
		if (tasks.tasks?.length) {
			content += '## 📝 Implementation Tasks\n\n';
			tasks.tasks.forEach((task: any, i: number) => {
				content += `### ${i + 1}. ${task.title}\n`;
				content += `**Description:** ${task.description}\n`;
				if (task.filePath) {
					content += `**File:** \`${task.filePath}\`\n`;
				}
				if (task.dependencies?.length) {
					content += `**Dependencies:** ${task.dependencies.join(', ')}\n`;
				}
				if (task.estimatedTime) {
					content += `**Time:** ${task.estimatedTime}\n`;
				}
				if (task.complexity) {
					content += `**Complexity:** ${task.complexity.toUpperCase()}\n`;
				}
				content += '\n';
			});
		}
		
		if (tasks.reasoning) {
			content += `## 🤔 Reasoning\n${tasks.reasoning}\n`;
		}
		
		return content || 'No structured tasks found';
	}

	private formatCodeStructured(code: any): string {
		console.log('💻 Formatting code:', code);
		let content = '';
		
		if (code.files?.length) {
			content += '## 📁 Generated Files\n\n';
			code.files.forEach((file: any, i: number) => {
				content += `### ${i + 1}. ${file.path}\n`;
				content += `${file.description}\n\n`;
				
				// Show a preview of the code (first few lines)
				if (file.content) {
					const lines = file.content.split('\n').slice(0, 10);
					content += '```typescript\n';
					content += lines.join('\n');
					if (file.content.split('\n').length > 10) {
						content += '\n... (truncated)';
					}
					content += '\n```\n\n';
				}
			});
		}
		
		if (code.reasoning) {
			content += `## 🤔 Implementation Notes\n${code.reasoning}\n`;
		}
		
		return content || 'No structured code found';
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
}