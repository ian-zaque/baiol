const DINOSAURS = [
  'Tyrannosaurus',
  'Triceratops',
  'Stegosaurus',
  'Velociraptor',
  'Brachiosaurus',
  'Diplodocus',
  'Spinosaurus',
  'Ankylosaurus',
  'Parasaurolophus',
  'Allosaurus',
  'Iguanodon',
  'Pteranodon',
  'Archaeopteryx',
  'Compsognathus',
  'Carnotaurus',
  'Apatosaurus',
  'Gallimimus',
  'Pachycephalosaurus',
  'Maiasaura',
  'Dilophosaurus',
  'Styracosaurus',
  'Therizinosaurus',
  'Oviraptor',
  'Protoceratops',
] as const;

function hashId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Stable nickname for a guest. The same id always starts at the same dinosaur. */
export function dinosaurNickname(guestId: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const start = hashId(guestId) % DINOSAURS.length;
  for (let offset = 0; offset < DINOSAURS.length; offset += 1) {
    const name = DINOSAURS[(start + offset) % DINOSAURS.length];
    if (!used.has(name)) {
      return name;
    }
  }
  return `${DINOSAURS[start]} ${used.size + 1}`;
}
