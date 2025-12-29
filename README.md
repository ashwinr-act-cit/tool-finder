#> Tool Finder

A web application that helps users discover software tools based on specific requirements. It utilizes the Google Gemini API to parse natural language queries and returns structured recommendations for relevant software.

**Live Demo:** https://tools-finder.me

##> Project Overview

This project solves the problem of finding specific software for niche use cases (e.g., "video editing software for 4GB RAM laptops"). Instead of generic search results, it uses a Large Language Model (LLM) to generate a JSON-structured list of tools with descriptions, licensing information, and official links.

The backend is built on Next.js API routes and implements a custom robust error-handling strategy to manage API quotas and model availability.

##> Tech Stack

* **Frontend:** Next.js (React), Tailwind CSS
* **Backend:** Next.js Serverless Functions
* **AI Integration:** Google Generative AI SDK (Gemini)
* **Hosting:** Vercel
* **DNS/Domain:** Namecheap

##> Key Features

* **Intelligent Model Selection:** The application dynamically queries available models associated with the API key.
* **Fallback Logic:** It prioritizes high-intelligence models (Gemini 1.5 Pro) for better accuracy. If the primary model fails due to rate limits or timeouts, the system automatically degrades to faster, lighter models (Gemini 1.5 Flash) to ensure a response is always generated.
* **JSON Enforcement:** The prompt engineering ensures the AI outputs strictly formatted JSON, preventing frontend parsing errors.

##> Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/ashwin07/tools-finder.git](https://github.com/ashwin07/tools-finder.git)
    cd tools-finder
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env.local` file in the root directory and add your Google Gemini API key:
    ```bash
    GEMINI_API_KEY=your_api_key_here
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

5.  **Access the application**
    Open http://localhost:3000 in your browser.

##> How It Works

1.  **User Input:** The user types a query into the search bar.
2.  **API Route:** The request is sent to the `/api/generate` endpoint.
3.  **Model Discovery:** The server checks which Gemini models are active and sorts them by capability (Intelligence > Speed).
4.  **Generation Loop:** The system attempts to generate a response using the first model. If it encounters a 429 (Quota Exceeded) or 503 (Overloaded) error, it logs the warning and immediately retries with the next model in the priority list.
5.  **Response:** The raw text is cleaned to remove markdown formatting, parsed into JSON, and sent back to the frontend for rendering.

##> License

This project is open source and available under the MIT License.
