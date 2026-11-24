# Vision evaluation

Model: `Xenova/siglip-base-patch16-224` (q8), vision tower in ONNX, labels embedded offline. 40 real photos of 18 catalog items photographed by the author with a phone, none removed after seeing the result. Speed: 363 ms/image on a laptop CPU (Node, not WebGPU).

| Metric | Result |
| --- | --- |
| Exact item, top-1 | 21/40 (52.5%) |
| Exact item, in top-3 | 26/40 (65.0%) |
| **Correct bin**, answer returned for every photo | 28/40 (70.0%) |
| Photos answered *confidently* | 12/40 (30.0%) |
| **Correct bin when confident** | 11/12 (91.7%) |
| "Likely" (asks to confirm) | 19, correct bin 63.2% |
| "Unsure" (asks the user to pick) | 9, correct bin 55.6% |

The app never hides uncertainty: below the confident threshold it shows the top candidates and asks.

## Wrong but confident
- shoes (textile) → sponge (grey) [1.jpg]

## Threshold sweep (confident answers)
| stream ≥ | item ≥ | confident | precision |
| --- | --- | --- | --- |
| 0.6 | 0.3 | 29 | 79.3% |
| 0.6 | 0.45 | 29 | 79.3% |
| 0.6 | 0.6 | 27 | 77.8% |
| 0.7 | 0.3 | 24 | 79.2% |
| 0.7 | 0.45 | 24 | 79.2% |
| 0.7 | 0.6 | 23 | 78.3% |
| 0.8 | 0.3 | 19 | 78.9% |
| 0.8 | 0.45 | 19 | 78.9% |
| 0.8 | 0.6 | 19 | 78.9% |
| 0.9 | 0.3 | 12 | 91.7% |
| 0.9 | 0.45 | 12 | 91.7% |
| 0.9 | 0.6 | 12 | 91.7% |

## Per item
| Item | Photos | Item top-1 | Bin correct |
| --- | --- | --- | --- |
| Cardboard box | 2 | 0 | 2 |
| Coffee capsule | 2 | 0 | 2 |
| Coffee grounds and tea bags | 2 | 0 | 1 |
| Plastic bottle for detergent, shampoo, shower gel or sauce | 2 | 0 | 0 |
| Drinking glass or wine glass | 2 | 2 | 2 |
| Drink carton (milk, juice, broth) | 4 | 4 | 4 |
| Eggshells | 2 | 2 | 2 |
| Food tin | 2 | 2 | 2 |
| Fruit peels and cores | 2 | 0 | 0 |
| Glass jar | 2 | 2 | 1 |
| Light bulb or fluorescent tube | 2 | 1 | 1 |
| Medicines, blister packs and their boxes | 2 | 2 | 2 |
| Used paper napkins and kitchen roll | 2 | 0 | 0 |
| Tupperware, bucket or plastic household object | 2 | 1 | 2 |
| Shoes and trainers | 2 | 1 | 1 |
| Crisp packet or snack wrapper | 4 | 0 | 2 |
| Kitchen sponge and cloth | 2 | 2 | 2 |
| Yogurt pot or plastic tub | 2 | 2 | 2 |

## A catalog change we tried and rejected (2026-11-24)
After this run we added one extra text description to eight items that failed here (sauce squeeze bottle, foil pouch,
car bulb, avocado skin, wet tea bag, paper tissue, dish cloth, slide sandal). On these 40 phone photos the correct bin
rose from 70.0% to 72.5% and confident answers became 14/14 correct. But those descriptions were written while looking
at these same photos, so that gain is not evidence. On the 272 Commons photos, which played no part in the change, the
correct bin fell from 79.4% to 77.9% and confident coverage from 57.0% to 52.9%. We reverted the vision descriptions
and kept only new text-search synonyms (sauce bottle, ketchup), which do not touch the image model. The numbers above
are from the unchanged model.
