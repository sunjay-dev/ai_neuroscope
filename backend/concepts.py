"""Labeled probe sets used to discover and name concept-selective units.

Each concept contrasts a set of texts (side A) against either an opposite set
(binary concepts, e.g. feminine vs masculine) or a shared neutral baseline
(unary concepts, e.g. royalty vs ordinary nouns). The backend runs every text
through the model once at startup and scores every attention head and MLP
neuron by how strongly it separates the two sides (Cohen's d).
"""

NEUTRAL_WORDS = [
    "table", "chair", "window", "paper", "road", "box", "door", "wall", "cup",
    "bottle", "street", "floor", "pencil", "bag", "card", "shelf", "corner",
    "button", "plate", "rope", "brick", "wire", "page", "lamp", "basket",
    "carpet", "tool", "ladder", "bucket", "folder",
]

CONCEPTS = {
    "gender": {
        "name": "Gender",
        "side_a": "feminine",
        "side_b": "masculine",
        "kind": "word",
        "a": [
            "she", "her", "woman", "girl", "mother", "sister", "daughter", "wife",
            "queen", "princess", "lady", "aunt", "niece", "actress", "female",
            "grandmother", "bride", "mom", "herself", "waitress", "women", "girls",
        ],
        "b": [
            "he", "his", "man", "boy", "father", "brother", "son", "husband",
            "king", "prince", "gentleman", "uncle", "nephew", "actor", "male",
            "grandfather", "groom", "dad", "himself", "waiter", "men", "boys",
        ],
    },
    "sentiment": {
        "name": "Sentiment",
        "side_a": "positive",
        "side_b": "negative",
        "kind": "word",
        "a": [
            "love", "wonderful", "happy", "excellent", "great", "beautiful",
            "amazing", "joy", "delightful", "fantastic", "kind", "brilliant",
            "pleasant", "awesome", "perfect", "lovely", "enjoy", "best", "glad",
            "superb", "kindness", "success",
        ],
        "b": [
            "hate", "terrible", "sad", "awful", "bad", "ugly", "horrible",
            "misery", "disgusting", "dreadful", "cruel", "stupid", "unpleasant",
            "worst", "broken", "nasty", "angry", "failure", "miserable", "pain",
            "boring", "cruelty",
        ],
    },
    "sarcasm": {
        "name": "Sarcasm",
        "side_a": "sarcastic",
        "side_b": "sincere",
        "kind": "sentence",
        "a": [
            "Oh great, another Monday morning meeting.",
            "Wow, I just love being stuck in traffic for hours.",
            "Fantastic, my flight got cancelled again. Just what I needed.",
            "Oh sure, because that plan worked so well last time.",
            "Yeah, waiting in line all day is my favorite hobby.",
            "Brilliant idea, let's lock the keys in the car.",
            "Oh wonderful, it's raining on my day off. How lucky.",
            "Thanks a lot for eating my lunch, really appreciate it.",
            "Great job breaking the printer, genius.",
            "Oh perfect, my phone died right when I needed it.",
            "Nice, another bill in the mail. My day is complete.",
            "Wow, what a surprise, the bus is late again.",
            "Oh joy, more homework over the holidays.",
            "Sure, I'd love to work this weekend for free.",
            "Clearly the best decision anyone has ever made.",
            "Lovely, the wifi is down during my presentation.",
        ],
        "b": [
            "Great, the meeting went well and we finished early.",
            "I really love spending time with my family on weekends.",
            "Fantastic, my flight arrived early and the hotel is lovely.",
            "That plan worked well and the team was happy with it.",
            "Gardening on Sunday afternoons is my favorite hobby.",
            "Good idea, let's take the train so we can relax.",
            "It's sunny on my day off, so I'm going to the beach.",
            "Thanks a lot for cooking dinner, it was delicious.",
            "Great job fixing the printer, it works perfectly now.",
            "My phone is fully charged and ready for the trip.",
            "I got a letter from an old friend in the mail today.",
            "The bus arrived right on time this morning.",
            "The kids enjoyed their holiday at the lake.",
            "I'm happy to help my neighbor move this weekend.",
            "Choosing this school was a good decision for us.",
            "The wifi worked smoothly during my presentation.",
        ],
    },
    "royalty": {
        "name": "Royalty",
        "side_a": "royalty",
        "side_b": "ordinary nouns",
        "kind": "word",
        "a": [
            "king", "queen", "prince", "princess", "throne", "crown", "royal",
            "monarch", "emperor", "empress", "kingdom", "duke", "duchess",
            "palace", "reign", "majesty", "dynasty", "castle", "knight",
            "monarchy", "sovereign", "realm",
        ],
        "b": NEUTRAL_WORDS,
    },
    "profession": {
        "name": "Profession",
        "side_a": "professions",
        "side_b": "ordinary nouns",
        "kind": "word",
        "a": [
            "doctor", "nurse", "teacher", "engineer", "lawyer", "pilot", "chef",
            "scientist", "surgeon", "farmer", "programmer", "architect",
            "accountant", "dentist", "professor", "plumber", "pharmacist",
            "journalist", "electrician", "mechanic", "physician", "manager",
        ],
        "b": NEUTRAL_WORDS,
    },
    "place": {
        "name": "Place / Geography",
        "side_a": "places",
        "side_b": "ordinary nouns",
        "kind": "word",
        "a": [
            "London", "Paris", "Japan", "Africa", "Texas", "Canada", "Berlin",
            "India", "Brazil", "China", "Europe", "Chicago", "Tokyo", "Mexico",
            "Egypt", "Australia", "Rome", "Russia", "California", "Spain",
            "Germany", "Boston",
        ],
        "b": NEUTRAL_WORDS,
    },
    "time": {
        "name": "Time",
        "side_a": "time words",
        "side_b": "ordinary nouns",
        "kind": "word",
        "a": [
            "Monday", "Tuesday", "Friday", "Sunday", "January", "March",
            "October", "December", "morning", "evening", "yesterday", "tomorrow",
            "tonight", "week", "month", "year", "hour", "minute", "night",
            "afternoon", "decade", "century",
        ],
        "b": NEUTRAL_WORDS,
    },
    "animal": {
        "name": "Animals",
        "side_a": "animals",
        "side_b": "ordinary nouns",
        "kind": "word",
        "a": [
            "dog", "cat", "horse", "lion", "tiger", "elephant", "bird", "fish",
            "wolf", "bear", "rabbit", "monkey", "snake", "eagle", "cow", "sheep",
            "mouse", "deer", "fox", "whale", "dolphin", "shark",
        ],
        "b": NEUTRAL_WORDS,
    },
    "number": {
        "name": "Numbers",
        "side_a": "numbers",
        "side_b": "ordinary nouns",
        "kind": "word",
        "a": [
            "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
            "ten", "twenty", "hundred", "thousand", "million", "dozen", "fifty",
            "1", "2", "5", "10", "100", "2024",
        ],
        "b": NEUTRAL_WORDS,
    },
}

# Generic text used only to estimate each unit's typical activation range, so
# "firing intensely" can be reported as a z-score comparable across layers.
CALIBRATION_SENTENCES = [
    "The weather was cold, so we stayed inside and read books.",
    "She opened the door and walked into the kitchen.",
    "Scientists announced a new discovery about distant galaxies.",
    "He forgot his keys at the office again.",
    "The market was busy with people buying fresh vegetables.",
    "After dinner, the children played games in the garden.",
    "Our team will present the quarterly results on Thursday.",
    "The old bridge was repaired after the storm last year.",
    "I think the movie was too long, but the music was good.",
    "They traveled across the country by train.",
    "Please send me the report before the end of the day.",
    "The cat slept on the warm windowsill all afternoon.",
    "A small company in Ohio builds custom bicycles.",
    "The president gave a speech about the economy.",
    "My brother and I cooked pasta for our parents.",
    "The museum is closed on Mondays and public holidays.",
    "Water boils at one hundred degrees Celsius.",
    "The students asked many questions during the lecture.",
    "If it rains tomorrow, the game will be postponed.",
    "She is learning to play the piano and the guitar.",
    "The software update fixed several security problems.",
    "We watched the sunset from the top of the hill.",
    "Honestly, that was the worst pizza I have ever eaten.",
    "The queen visited the hospital and thanked the nurses.",
    "Oh great, the printer is jammed again.",
]
