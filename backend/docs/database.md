# Database Design

## 1. users
Stores the main user account/basic registration data.

Fields:
- id
- name
- age
- gender
- county
- town
- phone_number
- created_at
- updated_at

## 2. user_details
Stores additional profile details.

Fields:
- id
- user_id
- education_level
- profession
- marital_status
- religion
- ethnicity
- created_at
- updated_at

## 3. user_descriptions
Stores self-description.

Fields:
- id
- user_id
- description
- created_at
- updated_at

## 4. match_requests
Stores searches made by users.

Fields:
- id
- user_id
- age_range_min
- age_range_max
- town
- created_at

## 5. match_results
Stores which profiles were shown for a given request.

Fields:
- id
- match_request_id
- matched_user_id
- result_order
- created_at

## 6. interest_requests
Stores when one user asks for more details about another user.

Fields:
- id
- requester_user_id
- target_user_id
- status
- created_at
- updated_at

Status values:
- pending
- accepted
- rejected

## 7. consent_responses
Stores response to interest request.

Fields:
- id
- interest_request_id
- responder_user_id
- response
- created_at

Response values:
- YES
- NO

## Relationships

- One user has one user_details record
- One user has one user_descriptions record
- One user can make many match_requests
- One match_request can have many match_results
- One match_result belongs to one matched user
- One user can make many interest_requests
- One user can receive many interest_requests
- One interest_request can have one consent_response
