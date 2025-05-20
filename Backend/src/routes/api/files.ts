import { API_KEY_HEADER, COOKIE, fileRouter, prisma } from "../..";
import { checkAuthentication } from "../../lib/Authentication";
import Docker from "dockerode";
import path from "path";
import * as fs from "fs/promises";

// Add Docker integration
const docker = new Docker();

// Helper function to update container dependencies when key files change
async function updateContainerDependencies(
  functionId: number,
  filename: string,
  content: string
) {
  // Only process dependency files
  if (filename !== "requirements.txt" && filename !== "package.json") {
    return;
  }

  const containerName = `shsf_func_${functionId}`;
  try {
    const container = docker.getContainer(containerName);
    await container.restart();
    console.log(
      `[SHSF] Restarted container ${containerName} due to changes in ${filename}`
    );
    return true;
  } catch (err) {
    console.error(`[SHSF] Failed to restart container ${containerName}:`, err);
    return false;
  }
}

export = new fileRouter.Path("/")
  .http("PUT", "/api/function/{id}/file", (http) =>
    http.onRequest(async (ctr) => {
      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );

      if (!authCheck.success) {
        return ctr.print({
          status: 401,
          message: authCheck.message,
        });
      }

      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          filename: z.string().min(1).max(256),
          code: z.string(),
        })
      );

      if (!data) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: error.toString(),
        });
      }

      const DisallowedFiles = ["_runner.py", "_runner.js", "init.sh"];
      if (DisallowedFiles.includes(data.filename)) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: `File name "${data.filename}" is not allowed`,
        });
      }

      const id = ctr.params.get("id");
      if (!id) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Missing function id",
        });
      }
      const functionId = parseInt(id);
      if (isNaN(functionId)) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Invalid function id",
        });
      }

      const existingFile = await prisma.functionFile.findFirst({
        where: {
          functionId: functionId,
          name: data.filename,
        },
      });

      let out;
      if (existingFile) {
        out = await prisma.functionFile.update({
          where: {
            id: existingFile.id,
          },
          data: {
            content: data.code,
          },
        });
      } else {
        out = await prisma.functionFile.create({
          data: {
            name: data.filename,
            content: data.code,
            functionId: functionId,
          },
        });
      }

      return ctr.print({
        status: "OK",
        data: out,
      });
    })
  )
  .http("GET", "/api/function/{id}/files", (http) =>
    http.onRequest(async (ctr) => {
      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );

      if (!authCheck.success) {
        return ctr.print({
          status: 401,
          message: authCheck.message,
        });
      }

      const id = ctr.params.get("id");
      if (!id) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Missing function id",
        });
      }
      const functionId = parseInt(id);
      if (isNaN(functionId)) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Invalid function id",
        });
      }

      const files = await prisma.functionFile.findMany({
        where: {
          functionId: functionId,
        },
      });

      return ctr.print({
        status: "OK",
        data: files,
      });
    })
  )
  .http("DELETE", "/api/function/{id}/file/{fileId}", (http) =>
    http.onRequest(async (ctr) => {
      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );

      if (!authCheck.success) {
        return ctr.print({
          status: 401,
          message: authCheck.message,
        });
      }

      const id = ctr.params.get("id");
      const fileId = ctr.params.get("fileId");

      if (!id || !fileId) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Missing function id or file id",
        });
      }

      const functionId = parseInt(id);
      const fileIdInt = parseInt(fileId);

      if (isNaN(functionId) || isNaN(fileIdInt)) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Invalid function id or file id",
        });
      }

      const totalFiles = await prisma.functionFile.count({
        where: {
          functionId: functionId,
        },
      });

      if (totalFiles <= 1) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Cannot delete the only file in the function",
        });
      }

      const fileToDelete = await prisma.functionFile.findUnique({
        where: { id: fileIdInt },
      });

      await prisma.functionFile.delete({
        where: {
          id: fileIdInt,
        },
      });

      // If deleting a dependencies file, we should create an empty one
      // to prevent broken deployments
      if (
        fileToDelete &&
        (fileToDelete.name === "requirements.txt" ||
          fileToDelete.name === "package.json")
      ) {
        const funcAppDir = path.join(
          "/opt/shsf_data/functions",
          String(functionId),
          "app"
        );
        try {
          await fs.writeFile(
            path.join(funcAppDir, fileToDelete.name),
            "# File was deleted\n"
          );
          console.log(
            `[SHSF] Created empty ${fileToDelete.name} after deletion to prevent broken deployments`
          );
        } catch (err) {
          console.error(
            `[SHSF] Error creating empty ${fileToDelete.name}:`,
            err
          );
        }
      }

      return ctr.print({
        status: "OK",
        message: "File deleted successfully",
      });
    })
  )
  .http("PATCH", "/api/function/{id}/file/{fileId}/rename", (http) =>
    http.onRequest(async (ctr) => {
      const authCheck = await checkAuthentication(
        ctr.cookies.get(COOKIE),
        ctr.headers.get(API_KEY_HEADER)
      );

      if (!authCheck.success) {
        return ctr.print({
          status: 401,
          message: authCheck.message,
        });
      }

      const id = ctr.params.get("id");
      const fileId = ctr.params.get("fileId");

      if (!id || !fileId) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Missing function id or file id",
        });
      }

      const [data, error] = await ctr.bindBody((z) =>
        z.object({
          newFilename: z.string().min(1).max(256),
        })
      );

      if (!data) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: error.toString(),
        });
      }

      const functionId = parseInt(id);
      const fileIdInt = parseInt(fileId);

      if (isNaN(functionId) || isNaN(fileIdInt)) {
        return ctr.status(ctr.$status.BAD_REQUEST).print({
          status: 400,
          message: "Invalid function id or file id",
        });
      }

      const oldFile = await prisma.functionFile.findUnique({
        where: { id: fileIdInt },
      });

      const updatedFile = await prisma.functionFile.update({
        where: {
          id: fileIdInt,
        },
        data: {
          name: data.newFilename,
        },
      });

      // Handle renames of dependency files, which requires updating files on disk too
      if (
        oldFile &&
        (oldFile.name === "requirements.txt" ||
          oldFile.name === "package.json" ||
          data.newFilename === "requirements.txt" ||
          data.newFilename === "package.json")
      ) {
        const funcAppDir = path.join(
          "/opt/shsf_data/functions",
          String(functionId),
          "app"
        );
        try {
          // If renaming away from a dependency file, create an empty one
          if (
            oldFile.name === "requirements.txt" ||
            oldFile.name === "package.json"
          ) {
            await fs.writeFile(
              path.join(funcAppDir, oldFile.name),
              "# File was renamed\n"
            );
            console.log(
              `[SHSF] Created empty ${oldFile.name} after rename to prevent broken deployments`
            );
          }

          // If renaming to a dependency file, write the content and update dependencies
          if (
            data.newFilename === "requirements.txt" ||
            data.newFilename === "package.json"
          ) {
            await fs.writeFile(
              path.join(funcAppDir, data.newFilename),
              updatedFile.content
            );
            await updateContainerDependencies(
              functionId,
              data.newFilename,
              updatedFile.content
            );
          }
        } catch (err) {
          console.error(
            `[SHSF] Error handling rename of dependency file:`,
            err
          );
        }
      }

      return ctr.print({
        status: "OK",
        data: updatedFile,
      });
    })
  );
