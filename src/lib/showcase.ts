import { SHOWCASE_RING, type Product, type Showcase, type ShowcaseRingView, type ShowcaseView } from "./types";

// Ângulo de cada foto ao redor do produto (0° = frente voltada para quem olha).
// Girando para a direita, a frente vai para a direita da tela e aparece a lateral direita do produto.
export const VIEW_ANGLE: Record<ShowcaseRingView, number> = {
  front: 0,
  frontRight: 45,
  right: 90,
  backRight: 135,
  back: 180,
  backLeft: 225,
  left: 270,
  frontLeft: 315,
};

export const VIEW_LABEL: Record<ShowcaseView, string> = {
  front: "Frente",
  frontRight: "Diagonal dianteira direita",
  right: "Lateral direita",
  backRight: "Diagonal traseira direita",
  back: "Traseira",
  backLeft: "Diagonal traseira esquerda",
  left: "Lateral esquerda",
  frontLeft: "Diagonal dianteira esquerda",
  top: "De cima",
  bottom: "Por baixo",
};

export const VIEW_SHORT: Record<ShowcaseView, string> = {
  front: "Frente",
  frontRight: "Diag. dianteira",
  right: "Lateral dir.",
  backRight: "Diag. traseira",
  back: "Traseira",
  backLeft: "Diag. traseira",
  left: "Lateral esq.",
  frontLeft: "Diag. dianteira",
  top: "Cima",
  bottom: "Baixo",
};

/** Fotos do giro que existem, em ordem de ângulo. */
export const ringViews = (s: Showcase) => SHOWCASE_RING.filter((v) => s.views[v]);

/** O showroom só aparece com pelo menos 2 fotos ao redor do produto. */
export const hasShowroom = (p: Pick<Product, "showcase">): p is { showcase: Showcase } => !!p.showcase && ringViews(p.showcase).length >= 2;
