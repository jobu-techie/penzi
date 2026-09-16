"""add support_messages table

Revision ID: 8dbee8410c31
Revises: ee20ceaf953b
Create Date: 2026-09-16 07:31:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8dbee8410c31'
down_revision = 'ee20ceaf953b'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('support_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('sender', sa.String(length=10), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('support_messages', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_support_messages_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('support_messages', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_support_messages_user_id'))

    op.drop_table('support_messages')
