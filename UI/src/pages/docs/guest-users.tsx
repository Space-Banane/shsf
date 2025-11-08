import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const GuestUsersDocPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>

        <ScrollProgressbar />
        <h1 className="text-3xl font-bold text-primary mb-2">
          Guest Users - Function-Specific Access
        </h1>

        <p className="mt-3 text-lg text-text/90 mb-6">
          SHSF allows function owners to create and assign <b>guest users</b> to
          individual functions. Guest users are identified by an email, display
          name, and password. This enables secure, limited access for
          collaborators or external users without granting full account
          privileges.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-4">
          Why Use Guest Users?
        </h2>
        <ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
          <li>
            <b>Granular Access Control:</b> Limit access to specific functions
            without exposing your main account or sensitive data.
          </li>
          <li>
            <b>Collaboration:</b> Allow external users, clients, or team members
            to interact with a function securely, without giving them full
            platform access.
          </li>
          <li>
            <b>Security:</b> Reduce risk by isolating guest credentials to only
            the functions they need.
          </li>
          <li>
            <b>Convenience:</b> Quickly grant and revoke access for temporary
            users or one-off integrations.
          </li>
        </ul>

        <div className="mb-6 p-4 bg-yellow-900/20 border-l-4 border-yellow-400 rounded">
          <b>Note:</b> Once a function has a guest user assigned, authentication
          is required to access it. Users must authenticate via guest account,
          secure header, or access key.
        </div>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-4">
          How Guest User Access Works
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90 space-y-2">
          <li>
            Function owners can create guest users with an email, display name,
            and password.
          </li>
          <li>Guest users are assigned to specific functions, not globally.</li>
          <li>
            When another user tries to access a protected function, SHSF prompts
            for the guest user's email and password.
          </li>
          <li>
            Authentication is enforced for any function with guest users
            assigned.
          </li>
          <li>
            Alternative authentication methods (secure header or access key) are
            also supported.
          </li>
        </ul>

        <h2 className="text-xl font-bold text-primary mt-8 mb-3">
          Best Practices
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>
            Assign guest users only to functions that require restricted access.
          </li>
          <li>Use strong passwords for guest accounts.</li>
          <li>Regularly review and update guest user assignments.</li>
          <li>
            Inform users about authentication requirements for protected
            functions.
          </li>
        </ul>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            🚀 Next Step - Execution Alias
          </h2>
          <p className="text-text/90 mb-4">
            Ugly UUID urls? Learn how to set human-readable execution aliases for
            your functions to make invocation easier via the Browser.
          </p>
          <a
            href="/docs/execution-alias"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            #18 Execution Alias
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};
