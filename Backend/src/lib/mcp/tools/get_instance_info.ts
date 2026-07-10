import { getUUID, getDisabledImages } from "../../DataManager";
import { VERSION } from "../../..";
import { McpToolDef, json, VALID_IMAGES } from "./shared";

const tool: McpToolDef = {
	name: "get_instance_info",
	description:
		"Get information about this SHSF instance: version, UUID, and available runtime images.",
	inputSchema: { type: "object", properties: {} },
	async handler(_args, _ctx) {
		const uuid = await getUUID();
		const disabledImages = await getDisabledImages();
		return json({
			version: VERSION.toString(),
			uuid,
			available_images: VALID_IMAGES.filter((img) => !disabledImages.includes(img)),
		});
	},
};

export default tool;
