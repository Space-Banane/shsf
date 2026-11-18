import { fileRouter } from "../../..";
import { getDisabledImages, setDisabledImages } from "../../../lib/DataManager";

export = new fileRouter.Path("/")
	.http("GET", "/api/global/disabled-images", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = ctr.getAuth();
			if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
			if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });
			return ctr.print({ status: "OK", disabledImages: await getDisabledImages() });
		}),
	)
	.http("PATCH", "/api/global/disabled-images", (http) =>
		http.onRequest(async (ctr) => {
			const authCheck = ctr.getAuth();
			if (!authCheck.success) return ctr.status(ctr.$status.UNAUTHORIZED).print({ status: "FAILED", message: authCheck.message });
			if (authCheck.user.role !== "Admin") return ctr.status(ctr.$status.FORBIDDEN).print({ status: "FAILED", message: "Admins only." });

			const [data, error] = await ctr.bindBody((z) =>
				z.object({ disabledImages: z.array(z.string()) }),
			);
			if (!data) return ctr.status(ctr.$status.BAD_REQUEST).print(error.toString());

			await setDisabledImages(data.disabledImages);
			return ctr.print({ status: "OK", disabledImages: data.disabledImages });
		}),
	);
