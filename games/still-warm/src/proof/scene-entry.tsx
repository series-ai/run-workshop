import { createRoot } from "react-dom/client";
import SceneReview from "./scene";

const root = document.getElementById("root");
if (!root) throw new Error("The room review root is missing.");
createRoot(root).render(<SceneReview />);
