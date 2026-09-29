from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.tours.models import Tour, TourMember


def register_and_login(client, email, full_name="Test User"):
    client.post(
        "/api/register/",
        {
            "full_name": full_name,
            "email": email,
            "phone": "0300",
            "password": "StrongPass123",
            "confirm_password": "StrongPass123",
        },
        format="json",
    )
    response = client.post(
        "/api/login/", {"email": email, "password": "StrongPass123"}, format="json"
    )
    token = response.data["tokens"]["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return response.data["user"]["id"]


class AuthTests(TestCase):
    def test_wrong_password_returns_error_not_empty_response(self):
        client = APIClient()
        client.post(
            "/api/register/",
            {
                "full_name": "A",
                "email": "a@example.com",
                "phone": "1",
                "password": "StrongPass123",
                "confirm_password": "StrongPass123",
            },
            format="json",
        )
        response = client.post(
            "/api/login/",
            {"email": "a@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("non_field_errors", response.data)


class TourFlowTests(TestCase):
    def setUp(self):
        self.creator = APIClient()
        self.member = APIClient()
        register_and_login(self.creator, "creator@example.com", "Creator")
        register_and_login(self.member, "member@example.com", "Member")

        response = self.creator.post(
            "/api/tours/create/",
            {
                "title": "Northern Trip",
                "destination": "Hunza",
                "budget": "50000",
                "start_date": "2026-06-01",
                "end_date": "2026-06-10",
                "status": "planned",
            },
            format="json",
        )
        self.tour = response.data
        self.tour_id = self.tour["id"]

    def test_tour_gets_a_unique_join_code_and_creator_is_a_member(self):
        self.assertTrue(self.tour["join_code"])
        self.assertEqual(self.tour["member_count"], 1)

    def test_creator_can_upload_an_image_when_creating_a_tour(self):
        image = SimpleUploadedFile(
            "cover.gif",
            (
                b"GIF87a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00"
                b"\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00"
                b"\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
            ),
            content_type="image/gif",
        )

        response = self.creator.post(
            "/api/tours/create/",
            {
                "title": "Image Tour",
                "destination": "Skardu",
                "budget": "30000",
                "start_date": "2026-07-01",
                "end_date": "2026-07-05",
                "status": "planned",
                "image": image,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["image"].startswith("/media/tours/"))
        self.assertTrue(response.data["image"].endswith(".gif"))

    def test_member_can_join_with_code_and_see_the_tour(self):
        response = self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        self.assertEqual(response.status_code, 201)

        listing = self.member.get("/api/tours/")
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(listing.data["results"][0]["member_count"], 2)

        detail = self.member.get(f"/api/tours/{self.tour_id}/")
        self.assertEqual(detail.data["member_count"], 2)

        members = self.member.get(f"/api/tours/{self.tour_id}/members/")
        self.assertEqual(members.data["count"], 2)
        self.assertEqual(len(members.data["results"]), 2)

    def test_joining_with_invalid_code_fails(self):
        response = self.member.post(
            "/api/tours/join/", {"join_code": "BADCODE"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_cannot_join_the_same_tour_twice(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        response = self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_non_member_cannot_view_tour(self):
        response = self.member.get(f"/api/tours/{self.tour_id}/")
        self.assertEqual(response.status_code, 404)

    def test_only_creator_can_delete_tour(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        response = self.member.delete(f"/api/tours/{self.tour_id}/")
        self.assertEqual(response.status_code, 403)

    def test_tour_list_marks_joined_tours_as_not_owned(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        response = self.member.get("/api/tours/")
        self.assertEqual(response.status_code, 200)
        tour = response.data["results"][0]
        self.assertFalse(tour["is_owner"])

    def test_creator_cannot_leave_own_tour(self):
        response = self.creator.post(f"/api/tours/{self.tour_id}/leave/")
        self.assertEqual(response.status_code, 400)

    def test_expense_split_and_report(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )

        self.creator.post(
            f"/api/tours/{self.tour_id}/expenses/",
            {"amount": "10000", "category": "hotel", "description": "Hotel"},
            format="json",
        )
        self.member.post(
            f"/api/tours/{self.tour_id}/expenses/",
            {"amount": "4000", "category": "food", "description": "Dinner"},
            format="json",
        )

        report = self.creator.get(f"/api/tours/{self.tour_id}/report/").data

        self.assertEqual(report["total_expense"], "14000.00")
        self.assertEqual(report["per_member_share"], "7000.00")

        balances = {m["email"]: m["balance"] for m in report["members"]}
        self.assertEqual(balances["creator@example.com"], "3000.00")
        self.assertEqual(balances["member@example.com"], "-3000.00")

    def test_settlement_payment_updates_report_balance(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        self.creator.post(
            f"/api/tours/{self.tour_id}/expenses/",
            {"amount": "1000", "category": "food", "description": "Lunch"},
            format="json",
        )

        response = self.member.post(
            f"/api/tours/{self.tour_id}/payments/",
            {
                "recipient": self.tour["created_by"],
                "amount": "500",
                "payment_method": "jazzcash",
                "note": "Settled lunch share",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["payment_method"], "jazzcash")
        self.assertEqual(response.data["status"], "pending")

        payment_id = response.data["id"]
        payer_review = self.member.post(
            f"/api/tours/{self.tour_id}/payments/{payment_id}/review/",
            {"action": "approved"},
            format="json",
        )
        self.assertEqual(payer_review.status_code, 404)

        report = self.member.get(f"/api/tours/{self.tour_id}/report/").data
        balances = {member["email"]: member["balance"] for member in report["members"]}
        self.assertEqual(balances["creator@example.com"], "500.00")
        self.assertEqual(balances["member@example.com"], "-500.00")
        self.assertEqual(len(report["payments"]), 1)

        payment_id = report["payments"][0]["id"]
        approval = self.creator.post(
            f"/api/tours/{self.tour_id}/payments/{payment_id}/review/",
            {"action": "approved"},
            format="json",
        )
        self.assertEqual(approval.status_code, 200)

        approved_report = self.member.get(f"/api/tours/{self.tour_id}/report/").data
        approved_balances = {
            member["email"]: member["balance"] for member in approved_report["members"]
        }
        self.assertEqual(approved_balances["creator@example.com"], "0.00")
        self.assertEqual(approved_balances["member@example.com"], "0.00")

    def test_creator_receives_pending_payment_notification(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        payment = self.member.post(
            f"/api/tours/{self.tour_id}/payments/",
            {
                "recipient": self.tour["created_by"],
                "amount": "500",
                "payment_method": "cash",
            },
            format="json",
        )
        self.assertEqual(payment.status_code, 201)

        creator_notifications = self.creator.get("/api/payment-notifications/")
        member_notifications = self.member.get("/api/payment-notifications/")

        self.assertEqual(creator_notifications.status_code, 200)
        self.assertEqual(creator_notifications.data["count"], 1)
        self.assertEqual(
            creator_notifications.data["notifications"][0]["tour_title"],
            "Northern Trip",
        )
        self.assertEqual(member_notifications.data["count"], 0)

    def test_payment_recipient_receives_payment_notification(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        member_id = User.objects.get(email="member@example.com").id
        payment = self.creator.post(
            f"/api/tours/{self.tour_id}/payments/",
            {
                "recipient": member_id,
                "amount": "750",
                "payment_method": "bank_transfer",
            },
            format="json",
        )
        self.assertEqual(payment.status_code, 201)

        member_notifications = self.member.get("/api/payment-notifications/")

        self.assertEqual(member_notifications.status_code, 200)
        self.assertEqual(member_notifications.data["count"], 1)
        self.assertTrue(member_notifications.data["notifications"][0]["received"])
        self.assertTrue(member_notifications.data["notifications"][0]["can_review"])
        self.assertEqual(
            str(member_notifications.data["notifications"][0]["amount"]), "750.00"
        )

    def test_only_the_adder_can_edit_or_delete_their_expense(self):
        self.member.post(
            "/api/tours/join/", {"join_code": self.tour["join_code"]}, format="json"
        )
        expense = self.creator.post(
            f"/api/tours/{self.tour_id}/expenses/",
            {"amount": "1000", "category": "other", "description": "Snacks"},
            format="json",
        ).data

        response = self.member.patch(
            f"/api/expenses/{expense['id']}/", {"amount": "1"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

        response = self.member.delete(f"/api/expenses/{expense['id']}/")
        self.assertEqual(response.status_code, 403)

    def test_dashboard_stats_reflect_the_users_tours(self):
        self.creator.post(
            f"/api/tours/{self.tour_id}/expenses/",
            {"amount": "5000", "category": "food", "description": "Lunch"},
            format="json",
        )
        response = self.creator.get("/api/dashboard-stats/")
        self.assertEqual(response.data["total_tours"], 1)
        self.assertEqual(float(response.data["total_expense"]), 5000.0)

    def test_dashboard_stats_separates_created_and_joined_tours(self):
        creator_user = User.objects.get(email="creator@example.com")
        member_user = User.objects.get(email="member@example.com")
        joined_tour = Tour.objects.create(
            created_by=member_user,
            title="Joined Tour",
            destination="Lahore",
            start_date="2026-10-01",
            end_date="2026-10-03",
        )
        TourMember.objects.create(tour=joined_tour, user=member_user, role="creator")
        TourMember.objects.create(tour=joined_tour, user=creator_user, role="member")

        response = self.creator.get("/api/dashboard-stats/")

        self.assertEqual([tour["title"] for tour in response.data["created_tours"]], ["Northern Trip"])
        self.assertEqual([tour["title"] for tour in response.data["joined_tours"]], ["Joined Tour"])
