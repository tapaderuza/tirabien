# Vision evaluation

Model: `Xenova/siglip-base-patch16-224` (q8), vision tower in ONNX, labels embedded offline. 272 real photos of 37 catalog items from Wikimedia Commons search results (search results, not hand-picked; 22 photos that plainly did not show the item were removed, each listed with its reason in eval/excluded.json). Speed: 260 ms/image on a laptop CPU (Node, not WebGPU).

| Metric | Result |
| --- | --- |
| Exact item, top-1 | 179/272 (65.8%) |
| Exact item, in top-3 | 230/272 (84.6%) |
| **Correct bin**, answer returned for every photo | 216/272 (79.4%) |
| Photos answered *confidently* | 155/272 (57.0%) |
| **Correct bin when confident** | 150/155 (96.8%) |
| "Likely" (asks to confirm) | 100, correct bin 60.0% |
| "Unsure" (asks the user to pick) | 15, correct bin 40.0% |

The app never hides uncertainty: below the confident threshold it shows the top candidates and asks.

## Wrong but confident
- food_can (yellow) → coffee_capsule (clean_point) [File:Heap of cans South Korea Pavilion Expo 2015.JPG]
- drink_carton (yellow) → cereal_box (blue) [File:Several Cartons.jpg]
- paper_bag (blue) → plastic_bag (yellow) [File:Paper Bag Michelle Nikou MRD 03.jpg]
- glass_bottle (green) → chemicals (clean_point) [File:Whisbih Liq 600cc empty glass bottle rear tag 20161026.jpg]
- coffee_grounds (brown) → ceramic (grey) [File:Coffee grounds yellow cup.jpg]

## Threshold sweep (confident answers)
| stream ≥ | item ≥ | confident | precision |
| --- | --- | --- | --- |
| 0.6 | 0.3 | 233 | 84.1% |
| 0.6 | 0.45 | 224 | 84.8% |
| 0.6 | 0.6 | 198 | 86.4% |
| 0.7 | 0.3 | 210 | 86.7% |
| 0.7 | 0.45 | 205 | 87.3% |
| 0.7 | 0.6 | 190 | 88.4% |
| 0.8 | 0.3 | 182 | 92.9% |
| 0.8 | 0.45 | 181 | 92.8% |
| 0.8 | 0.6 | 170 | 93.5% |
| 0.9 | 0.3 | 156 | 96.8% |
| 0.9 | 0.45 | 155 | 96.8% |
| 0.9 | 0.6 | 146 | 96.6% |

## Per item
| Item | Photos | Item top-1 | Bin correct |
| --- | --- | --- | --- |
| Plastic bottle | 8 | 4 | 7 |
| Drink can | 8 | 4 | 8 |
| Food tin | 8 | 1 | 2 |
| Drink carton (milk, juice, broth) | 5 | 2 | 4 |
| Plastic bag | 8 | 6 | 7 |
| Yogurt pot or plastic tub | 4 | 0 | 4 |
| Aluminium foil and trays | 8 | 2 | 6 |
| Empty aerosol can (deodorant, hairspray, cream) | 8 | 6 | 7 |
| Detergent, shampoo or shower gel bottle | 7 | 7 | 7 |
| Cardboard box | 8 | 5 | 6 |
| Newspapers and magazines | 5 | 3 | 3 |
| Cardboard egg box | 7 | 5 | 5 |
| Pizza box | 8 | 6 | 6 |
| Paper bag | 8 | 2 | 4 |
| Glass bottle | 8 | 3 | 4 |
| Glass jar | 6 | 5 | 5 |
| Drinking glass or wine glass | 8 | 6 | 6 |
| Ceramic plate, mug or pot | 8 | 6 | 6 |
| Light bulb or fluorescent tube | 7 | 5 | 7 |
| Fruit peels and cores | 8 | 7 | 7 |
| Eggshells | 7 | 5 | 6 |
| Coffee grounds and tea bags | 8 | 6 | 6 |
| Diaper | 8 | 8 | 8 |
| Cigarette butts and ash | 6 | 3 | 4 |
| Toothbrush | 7 | 5 | 5 |
| Clothes | 6 | 0 | 2 |
| Shoes and trainers | 8 | 7 | 7 |
| Used cooking oil | 8 | 4 | 4 |
| Batteries | 8 | 8 | 8 |
| Phone, tablet or small gadget | 8 | 6 | 7 |
| Cables and chargers | 8 | 4 | 7 |
| Paint, varnish and solvents | 8 | 6 | 7 |
| Medicines, blister packs and their boxes | 8 | 8 | 8 |
| Furniture, mattresses and bulky items | 5 | 3 | 4 |
| Coffee capsule | 8 | 8 | 8 |
| Toy | 8 | 6 | 6 |
| Mirror or window glass | 8 | 7 | 8 |
