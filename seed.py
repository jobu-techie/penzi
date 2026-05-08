import random
from app import create_app, db
from app.models import User, UserDetails, UserDescription

app = create_app()

kenyan_counties = {
    "Nairobi": ["Westlands", "Kibera", "Kasarani", "Embakasi", "Langata"],
    "Mombasa": ["Nyali", "Likoni", "Kisauni", "Changamwe", "Mvita"],
    "Kisumu": ["Kisumu Central", "Kisumu East", "Kisumu West", "Muhoroni", "Nyando"],
    "Nakuru": ["Nakuru Town", "Naivasha", "Gilgil", "Subukia", "Molo"],
    "Eldoret": ["Eldoret Town", "Turbo", "Moiben", "Ainabkoi", "Kapseret"],
    "Kisii": ["Kisii Town", "Nyamache", "Gucha", "Masaba", "Nyaribari"],
    "Thika": ["Thika Town", "Ruiru", "Juja", "Gatundu", "Githunguri"],
    "Machakos": ["Machakos Town", "Athi River", "Matungulu", "Kangundo", "Mwala"],
    "Meru": ["Meru Town", "Imenti", "Tigania", "Igembe", "Buuri"],
    "Nyeri": ["Nyeri Town", "Tetu", "Mathira", "Mukurweini", "Kieni"],
    "Garissa": ["Garissa Town", "Dadaab", "Fafi", "Ijara", "Hulugho"],
    "Kakamega": ["Kakamega Town", "Mumias", "Butere", "Matungu", "Khwisero"],
    "Bungoma": ["Bungoma Town", "Webuye", "Kimilili", "Sirisia", "Bumula"],
    "Kilifi": ["Kilifi Town", "Malindi", "Watamu", "Kaloleni", "Rabai"],
    "Kwale": ["Kwale Town", "Msambweni", "Kinango", "Lunga Lunga", "Ukunda"],
    "Kitui": ["Kitui Town", "Mwingi", "Mutomo", "Kyuso", "Mumoni"],
    "Makueni": ["Makueni Town", "Wote", "Makindu", "Kibwezi", "Kilungu"],
    "Kajiado": ["Kajiado Town", "Ngong", "Ongata Rongai", "Kitengela", "Namanga"],
    "Murang'a": ["Murang'a Town", "Kangema", "Mathioya", "Kigumo", "Maragua"],
    "Kirinyaga": ["Kerugoya", "Kutus", "Mwea", "Gichugu", "Ndia"],
}

male_names = [
    "James", "John", "Peter", "Paul", "David", "Joseph", "Samuel", "Daniel",
    "Michael", "Robert", "William", "Richard", "Thomas", "Charles", "George",
    "Kevin", "Brian", "Eric", "Stephen", "Patrick", "Francis", "Simon", "Mark",
    "Luke", "Andrew", "Philip", "Timothy", "Victor", "Dennis", "Martin",
]

female_names = [
    "Mary", "Grace", "Faith", "Hope", "Joyce", "Agnes", "Esther", "Ruth",
    "Sarah", "Hannah", "Mercy", "Joy", "Lydia", "Naomi", "Rachel", "Deborah",
    "Miriam", "Priscilla", "Tabitha", "Eunice", "Lilian", "Rose", "Anne",
    "Caroline", "Patricia", "Catherine", "Elizabeth", "Susan", "Jane", "Alice",
]

last_names = [
    "Kamau", "Mwangi", "Ochieng", "Otieno", "Wanjiku", "Njoroge", "Kipchoge",
    "Mutua", "Mwenda", "Omondi", "Auma", "Waweru", "Kariuki", "Ngugi", "Gitau",
    "Mbugua", "Kimani", "Gatheru", "Karanja", "Mugo", "Njagi", "Maina", "Gacheru",
    "Njenga", "Waithaka", "Kiprotich", "Chebet", "Rotich", "Koech", "Bett",
    "Abuya", "Onyango", "Ouma", "Owino", "Adhiambo", "Anyango", "Aoko",
    "Makena", "Wanjiru", "Wambui", "Njeri", "Wangari", "Nduta", "Mumbi",
]

educations = ["Primary", "Secondary", "Certificate", "Diploma", "Bachelors", "Masters", "PhD"]
professions = ["Teacher", "Engineer", "Doctor", "Nurse", "Farmer", "Business", "Lawyer",
               "Accountant", "Driver", "Mechanic", "Chef", "Designer", "Developer", "Salesperson"]
marital_statuses = ["Single", "Divorced", "Widowed"]
religions = ["Christian", "Muslim", "Hindu", "Traditional"]
ethnicities = ["Kikuyu", "Luo", "Kalenjin", "Kamba", "Luhya", "Kisii", "Meru",
               "Mijikenda", "Somali", "Maasai", "Taita", "Turkana"]

descriptions = [
    "I am a kind and loving person who enjoys nature and music.",
    "Fun loving and hardworking person who values family.",
    "I love cooking, reading and travelling to new places.",
    "Simple person who enjoys life and loves God.",
    "Ambitious and goal oriented individual seeking a serious relationship.",
    "I enjoy football, music and spending time with friends.",
    "A caring and honest person looking for true love.",
    "I am outgoing and love meeting new people.",
    "Passionate about life and love with a great sense of humor.",
    "Looking for a serious partner to build a future with.",
]

def generate_phone():
    prefix = random.choice(["0700", "0710", "0720", "0722", "0723", "0724",
                             "0725", "0726", "0727", "0728", "0729", "0790",
                             "0110", "0111", "0112", "0113", "0114", "0115"])
    suffix = str(random.randint(100000, 999999))
    raw = f"{prefix}{suffix}"
    # Normalize to 254 format
    return f"{prefix}{suffix}"

def seed_users(count=10000):
    with app.app_context():
        print("Starting seed...")
        existing_phones = set(u.phone_number for u in User.query.all())
        created = 0
        male_count = 0
        female_count = 0

        while created < count:
            gender = "MALE" if male_count < count // 2 else "FEMALE"
            if female_count >= count // 2:
                gender = "MALE"

            if gender == "MALE":
                first_name = random.choice(male_names)
                male_count += 1
            else:
                first_name = random.choice(female_names)
                female_count += 1

            last_name = random.choice(last_names)
            name = f"{first_name} {last_name}"
            age = random.randint(18, 55)

            county = random.choice(list(kenyan_counties.keys()))
            town = random.choice(kenyan_counties[county])

            phone = generate_phone()
            if phone in existing_phones:
                continue
            existing_phones.add(phone)

            user = User(
                name=name,
                age=age,
                gender=gender,
                county=county,
                town=town,
                phone_number=phone,
            )
            db.session.add(user)
            db.session.flush()

            details = UserDetails(
                user_id=user.id,
                education_level=random.choice(educations),
                profession=random.choice(professions),
                marital_status=random.choice(marital_statuses),
                religion=random.choice(religions),
                ethnicity=random.choice(ethnicities),
            )
            db.session.add(details)

            description = UserDescription(
                user_id=user.id,
                description=random.choice(descriptions),
            )
            db.session.add(description)

            created += 1

            if created % 500 == 0:
                db.session.commit()
                print(f"Created {created} users...")

        db.session.commit()
        print(f"Done! Created {created} users ({male_count} male, {female_count} female)")

if __name__ == "__main__":
    seed_users()