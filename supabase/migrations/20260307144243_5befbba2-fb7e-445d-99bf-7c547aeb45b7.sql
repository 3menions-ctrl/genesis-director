
UPDATE profiles
SET credits_balance = credits_balance + 1000,
    total_credits_purchased = COALESCE(total_credits_purchased, 0) + 1000,
    updated_at = now()
WHERE id = 'd600868d-651a-46f6-a621-a727b240ac7c';

INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
VALUES ('d600868d-651a-46f6-a621-a727b240ac7c', 1000, 'admin_grant', 'Admin manual credit grant: 1000 credits');
