import React from "react";

export const DocsPage = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-primary mb-4">
            {"<SHSF/>"} Documentation
          </h1>
          <p className="text-xl text-text/90 max-w-2xl mx-auto">
            Let's get coding with SHSF. Automate code you want to run whenever!
          </p>
          <div className="mt-6 h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid gap-6" id="lessons">
          {lessons.map((lesson) => (
            <Lesson
              key={lesson.title}
              identifier={lesson.identifier}
              title={lesson.title}
              description={lesson.description}
              link={lesson.link}
            />
          ))}
        </div>

        <div className="mt-16 p-8 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-2xl font-bold text-primary mb-4">
            🚀 Ready to Start?
          </h2>
          <p className="text-text/90 mb-6">
            Follow our step-by-step tutorials to master serverless functions
            with SHSF. Each lesson builds on the previous one, so we recommend
            starting from the beginning.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
              Functions
            </span>
            <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
              Triggers
            </span>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
              Automation
            </span>
            <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-sm">
              Webhooks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

function Lesson({
  title,
  description,
  link,
  identifier,
}: {
  title: string;
  description: string;
  link: string;
  identifier: string;
}) {
  return (
    <div className="group bg-background border border-primary/30 rounded-xl shadow-lg hover:shadow-xl hover:border-primary/50 transition-all duration-300 overflow-hidden">
      <a href={link} className="block">
        <div className="flex items-center gap-6 p-6">
          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-primary/30 rounded-xl group-hover:scale-105 transition-transform duration-300">
            <span className="text-primary text-xl font-bold">{identifier}</span>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-primary group-hover:text-blue-400 transition-colors mb-2">
              {title}
            </h3>
            <p className="text-text/80 leading-relaxed">{description}</p>
          </div>
          <div className="flex-shrink-0">
            <span className="text-primary text-2xl group-hover:translate-x-2 transition-transform duration-300">
              →
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}

const lessons: {
  key: string;
  identifier: string;
  title: string;
  description: string;
  link: string;
}[] = [
  {
    key: "getting-started",
    identifier: "#0",
    title: "Getting Started",
    description:
      "Learn how to set up and use SHSF for your serverless functions.",
    link: "/docs/getting-started",
  },
  {
    key: "my-first-function",
    identifier: "#1",
    title: "My First Function",
    description: "Learn how to create your first function.",
    link: "/docs/my-first-function",
  },
  {
    key: "data-passing",
    identifier: "#2",
    title: "Data Passing",
    description:
      "Learn how to pass data between triggers and functions using JSON payloads.",
    link: "/docs/data-passing",
  },
  {
    key: "custom-responses",
    identifier: "#3",
    title: "Custom Responses",
    description:
      "Learn how to create custom responses for your functions to handle different scenarios.",
    link: "/docs/custom-responses",
  },
  {
    key: "environment-variables",
    identifier: "#4",
    title: "Environment Variables",
    description:
      "Learn how to manage sensitive information like API keys using environment variables.",
    link: "/docs/environment-variables",
  },
  {
    key: "secure-headers",
    identifier: "#5",
    title: "Secure Headers",
    description:
      "Learn how to use secure headers to protect your functions from unauthorized access.",
    link: "/docs/secure-headers",
  },
  {
    key: "persistent-data",
    identifier: "#6",
    title: "Persistent Data",
    description: "Learn how to store and manage data for your functions.",
    link: "/docs/persistent-data",
  },
  {
    key: "redirects",
    identifier: "#7",
    title: "Redirects",
    description:
      "Learn how to implement HTTP redirects in your functions.",
    link: "/docs/redirects",
  },
  {
    key: "raw-body",
    identifier: "#8",
    title: "Raw Body",
    description: "Learn how to use args.raw_body for binary data and file uploads.",
    link: "/docs/raw-body",
  },
  {
    key: "user-interfaces",
    identifier: "#9",
    title: "User Interfaces",
    description: "Learn how to serve HTML files as user interfaces from your functions.",
    link: "/docs/user-interfaces",
  },
  {
    key: "docker-mount",
    identifier: "#10",
    title: "Docker Mount",
    description:
      "Learn how to use the Docker mount option to create and modify containers on the host.",
    link: "/docs/docker-mount",
  },
  {
    key: "serve-only",
    identifier: "#11",
    title: "Serve Only HTML",
    description:
      "Learn how to serve only an HTML file from your function.",
    link: "/docs/serve-only",
  },
  {
    key: "access-tokens",
    identifier: "#12",
    title: "Access Tokens",
    description: "Learn how to generate and use API access tokens for secure automation and integrations.",
    link: "/docs/access-tokens",
  },
  {
    key: "cli",
    identifier: "#13",
    title: "CLI Usage",
    description: "Learn how to use the shsf-cli to manage your functions, files, and environments from the command line.",
    link: "/docs/cli",
  },
  {
    key: "db-com",
    identifier: "#14",
    title: "Database Communication",
    description: "Learn how to use the Python database communication interface for fast persistent storage and retrieval.",
    link: "/docs/db-com",
  },
];
